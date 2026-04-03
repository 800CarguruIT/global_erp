# AI Voice Calls Implementation Plan
## Global ERP + Yeastar PBX Integration

**Date:** 2026-04-03
**Project:** Global ERP - AI-Powered Voice Calls
**Status:** Planning

---

## Overview

Integrate AI-powered voice calls into Global ERP using the existing Yeastar PBX dialer and a voice-bridge microservice. The system will allow inbound calls to be automatically answered by AI, conduct conversations, capture transcripts, create leads, and seamlessly hand off to human agents when needed.

### Current State

| Component | Status | Description |
|-----------|--------|-------------|
| Yeastar PBX Integration | Working | Outbound/inbound calls, webhooks, recordings, Linkus WebRTC SDK |
| Voice Bridge (`apps/voice-bridge/`) | Prototype | SIP/RTP <-> OpenAI Realtime API bridge, compiled JS only |
| AI Intelligence Layer | Working | 8 engines, Anthropic Claude + OpenAI, policy system |
| Call Center Module | Working | Dashboard, history, outbound, agent performance |
| Call AI Policy | Working | Business hours, number blocking, escalation rules |

### Target Architecture

```
Caller --> Yeastar PBX --> Webhook to ERP
  --> Policy check (allow_ai + live mode)
  --> Auto-pickup via Yeastar API (existing)
  --> Start voice-bridge session (new)
  --> Voice-bridge registers SIP extension, answers INVITE
  --> RTP audio <--> OpenAI Realtime API
  --> Transcript captured, callbacks sent to ERP
  --> AI handles conversation (greeting, info gathering, booking)
  --> If escalation needed: Yeastar API call/transfer --> human agent
  --> On hangup: full transcript stored, AI summary generated, lead created
```

---

## Phase 1: Voice Bridge Completion

**Goal:** Get the voice-bridge microservice production-ready with transcript capture, function calling, and ERP callback support.

**Estimated Files:** 8 modified, 1 new

### Step 1.1 - Restore TypeScript Source

- **Action:** Recover `.ts` source files from git commit `a37c21a`
- **Files:**
  - `apps/voice-bridge/src/index.ts`
  - `apps/voice-bridge/src/config.ts`
  - `apps/voice-bridge/src/log.ts`
  - `apps/voice-bridge/src/types.ts`
  - `apps/voice-bridge/src/sessionManager.ts`
  - `apps/voice-bridge/src/openaiRealtime.ts`
  - `apps/voice-bridge/src/sipRtpBridge.ts`
  - `apps/voice-bridge/src/sipSignaling.ts`
- **Verify:** `pnpm build` compiles successfully, `pnpm dev` starts the service

### Step 1.2 - Add Transcript Capture

- **File:** `apps/voice-bridge/src/openaiRealtime.ts`
- **Action:** In the `ws.on("message")` handler, add listeners for:
  - `conversation.item.input_audio_transcription.completed` --> caller's speech text
  - `response.audio_transcript.done` --> AI's spoken text
  - `response.done` --> full response with usage stats
- **Data Structure:**
  ```typescript
  type TranscriptEntry = {
    role: "user" | "assistant";
    text: string;
    timestamp: string;
  };
  ```
- **Storage:** Accumulate entries in array on session object

### Step 1.3 - Enable Whisper Transcription

- **File:** `apps/voice-bridge/src/openaiRealtime.ts`
- **Action:** In the `session.update` message, add:
  ```json
  {
    "input_audio_transcription": { "model": "whisper-1" }
  }
  ```
- **Result:** OpenAI will send real-time transcription of caller's speech

### Step 1.4 - Add OpenAI Function Calling (Tools)

- **File:** `apps/voice-bridge/src/openaiRealtime.ts`
- **Action:** Add `tools` array to `session.update`:

| Tool Name | Parameters | Purpose |
|-----------|------------|---------|
| `schedule_appointment` | name, date, service_type, vehicle_info | Book appointment |
| `escalate_to_agent` | reason | Transfer to human agent |
| `collect_customer_info` | name, phone, email, vehicle_plate | Capture customer details |
| `end_call` | summary | Caller wants to hang up |

- **Handler:** Listen for `response.function_call_arguments.done` events, dispatch to callback

### Step 1.5 - Add Callback URL Support

- **Files:** `apps/voice-bridge/src/types.ts`, `apps/voice-bridge/src/sessionManager.ts`
- **Action:** Extend `POST /sessions/start` request body:
  ```json
  {
    "providerCallId": "...",
    "companyId": "...",
    "extension": "...",
    "instructions": "...",
    "callbackUrl": "https://erp/api/webhooks/voice-bridge/events",
    "callbackToken": "shared-secret",
    "context": { "companyName": "...", "services": [...] }
  }
  ```

### Step 1.6 - Implement Callback Dispatch

- **File:** `apps/voice-bridge/src/sessionManager.ts` (new callback module)
- **Action:** Voice-bridge POSTs events to `callbackUrl`:

| Event | When | Payload |
|-------|------|---------|
| `session.ready` | AI connected and listening | `{ sessionId, extension }` |
| `transcript.update` | Every 3 seconds (batched) | `{ sessionId, segments: [...] }` |
| `function.called` | AI invoked a tool | `{ sessionId, functionName, arguments }` |
| `session.ended` | Call finished | `{ sessionId, transcript, duration, outcome }` |

### Step 1.7 - Add Transcript Endpoint

- **File:** `apps/voice-bridge/src/index.ts`
- **Action:** Add `GET /sessions/:id/transcript` endpoint
- **Response:**
  ```json
  {
    "ok": true,
    "transcript": [
      { "role": "assistant", "text": "Hello, how can I help?", "timestamp": "..." },
      { "role": "user", "text": "I need to book a service", "timestamp": "..." }
    ]
  }
  ```

### Step 1.8 - Session Timeout and Cleanup

- **Files:** `apps/voice-bridge/src/sessionManager.ts`, `apps/voice-bridge/src/sipRtpBridge.ts`
- **Action:**
  - Max session duration timer (configurable via `VOICE_BRIDGE_MAX_SESSION_DURATION_MS`, default 600000ms / 10 min)
  - RTP inactivity timeout (30 seconds no packets --> auto-close session)
  - Log final transcript to filesystem as backup

### Step 1.9 - PCMA Transcoding Support

- **File:** `apps/voice-bridge/src/sipRtpBridge.ts`
- **Action:**
  - Accept PayloadType 8 (PCMA/G.711 A-law) in addition to PT 0 (PCMU)
  - Add u-law <--> a-law transcoding lookup table (~50 lines)
  - Basic DTMF detection (RFC 2833 PT=101) --> forward as text to OpenAI

---

## Phase 2: Database Migrations

**Goal:** Create tables to store AI voice sessions, transcripts, and extend company policy.

**Estimated Files:** 3 new

### Step 2.1 - AI Voice Sessions Table

- **File:** `packages/ai-core/migrations/192_ai_voice_sessions.sql`
- **Schema:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Session ID |
| `call_session_id` | uuid FK | Link to `call_sessions` table |
| `company_id` | uuid FK | Company scope |
| `bridge_session_id` | text | Voice-bridge internal ID |
| `provider_call_id` | text | Yeastar call ID |
| `extension` | text | PBX extension used |
| `status` | text | starting / ready / active / transferring / completed / failed |
| `ai_model` | text | OpenAI model used |
| `ai_voice` | text | Voice used (alloy, nova, etc.) |
| `started_at` | timestamptz | When AI started handling |
| `ended_at` | timestamptz | When session ended |
| `duration_seconds` | integer | Total duration |
| `transcript_summary` | text | AI-generated summary |
| `outcome` | text | completed / escalated / caller_hangup / timeout / error |
| `outcome_details` | jsonb | Additional outcome data |
| `metadata` | jsonb | Extra data |
| `created_at` | timestamptz | Row creation |
| `updated_at` | timestamptz | Last update |

- **Indexes:** company_id+created_at, call_session_id, bridge_session_id, provider_call_id

### Step 2.2 - AI Voice Transcripts Table

- **File:** `packages/ai-core/migrations/193_ai_voice_transcripts.sql`
- **Schema:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Transcript entry ID |
| `ai_voice_session_id` | uuid FK | Link to `ai_voice_sessions` |
| `role` | text | user / assistant / system |
| `content` | text | Transcript text |
| `sequence_number` | integer | Order of the entry |
| `created_at` | timestamptz | When captured |

- **Index:** ai_voice_session_id + sequence_number

### Step 2.3 - Extend Company Call AI Policy

- **File:** `packages/ai-core/migrations/194_ai_voice_policy_extensions.sql`
- **New Columns on `company_call_ai_policy`:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `voice_bridge_enabled` | boolean | false | Master toggle for AI voice |
| `voice_bridge_extension` | text | null | PBX extension for AI to register |
| `voice_bridge_max_duration_seconds` | integer | 600 | Max call duration |
| `voice_bridge_voice` | text | 'alloy' | OpenAI voice to use |
| `voice_bridge_language` | text | 'en' | Conversation language |
| `ai_context` | jsonb | '{}' | Company knowledge base (services, FAQs, etc.) |

---

## Phase 3: ERP Backend Integration

**Goal:** Wire the ERP web app to the voice-bridge and handle callbacks for transcripts, escalation, and lead creation.

**Estimated Files:** 4 new, 2 modified

### Step 3.1 - Voice Bridge HTTP Client

- **File:** `packages/ai-core/src/voice-bridge/client.ts` (NEW)
- **Functions:**

| Function | HTTP Call | Purpose |
|----------|----------|---------|
| `startVoiceBridgeSession(params)` | POST `/sessions/start` | Start AI voice session |
| `stopVoiceBridgeSession(params)` | POST `/sessions/stop` | Stop session |
| `getVoiceBridgeSession(id)` | GET `/sessions/:id` | Get session status + transcript |
| `getVoiceBridgeHealth()` | GET `/health` | Health check |

- **Config from environment:**
  - `VOICE_BRIDGE_URL` (e.g., `http://192.168.0.162:8090`)
  - `VOICE_BRIDGE_API_TOKEN` (shared secret)

### Step 3.2 - AI Instruction Builder

- **File:** `packages/ai-core/src/voice-bridge/instructionBuilder.ts` (NEW)
- **Input:** CompanyCallAiPolicy, company profile, caller context
- **Output:** System prompt including:
  - Company name, services, location, business hours
  - Available appointment types
  - Escalation rules and keywords from policy
  - Language preference
  - Known customer info (if phone matched)
  - Vehicle history (if available)

### Step 3.3 - Modify Webhook Handler

- **File:** `apps/web/app/api/webhooks/dialer/[providerKey]/route.ts`
- **Location:** After `tryYeastarAutoPickup()` succeeds
- **Logic:**
  ```
  IF pickup succeeded
  AND policy.decision === "allow_ai"
  AND policy.mode === "live"
  AND policy.voice_bridge_enabled === true
  THEN:
    1. Build AI instructions from company context
    2. Call startVoiceBridgeSession({
         providerCallId, companyId, extension,
         instructions, callbackUrl, context
       })
    3. Insert row into ai_voice_sessions table
  ```

### Step 3.4 - Voice Bridge Callback Receiver

- **File:** `apps/web/app/api/webhooks/voice-bridge/events/route.ts` (NEW)
- **Auth:** Validates `x-voice-bridge-token` header
- **Event Handlers:**

| Event | Action |
|-------|--------|
| `session.ready` | Update `ai_voice_sessions.status` to 'ready' |
| `transcript.update` | Insert segments into `ai_voice_transcripts` table |
| `function.called: escalate_to_agent` | Call Yeastar API `call/transfer` to human extension, update status to 'transferring', stop voice-bridge session |
| `function.called: schedule_appointment` | Create inquiry/lead via existing `CallAiWorkflow.runCallAiWorkflow()` |
| `function.called: collect_customer_info` | Update inquiry record with structured customer data |
| `session.ended` | Store full transcript, generate AI summary, update session status to 'completed', trigger lead creation pipeline |

### Step 3.5 - Extend AI Policy Types

- **File:** `packages/ai-core/src/call-center/aiPolicy.ts`
- **Action:** Add to `CompanyCallAiPolicy` type:
  ```typescript
  voiceBridge: {
    enabled: boolean;
    extension: string | null;
    maxDurationSeconds: number;
    voice: string;
    language: string;
  };
  aiContext: {
    companyDescription: string;
    services: string[];
    faqs: Array<{ question: string; answer: string }>;
    appointmentTypes: string[];
    customInstructions: string;
  };
  ```

### Step 3.6 - Repository Functions

- **File:** `packages/ai-core/src/voice-bridge/repository.ts` (NEW)
- **Functions:**

| Function | Purpose |
|----------|---------|
| `insertAiVoiceSession(params)` | Create new session record |
| `updateAiVoiceSessionStatus(id, status, details)` | Update session status |
| `completeAiVoiceSession(id, outcome, summary)` | Mark session complete |
| `insertTranscriptSegments(sessionId, segments)` | Batch insert transcript entries |
| `getAiVoiceSession(id)` | Get session with transcript |
| `listAiVoiceSessions(companyId, filters)` | List sessions with pagination |
| `getActiveAiVoiceSessions(companyId)` | Get currently active sessions |

### Step 3.7 - Escalation Flow (AI --> Human)

- **Trigger:** Voice-bridge callback with `function.called: escalate_to_agent`
- **Flow:**
  1. Receive callback at ERP
  2. Look up available agent extension (round-robin or specific)
  3. Call Yeastar API `POST /call/transfer` with channel_id and target extension
  4. Update `ai_voice_sessions.status` = 'transferring'
  5. Stop voice-bridge session
  6. Yeastar PBX transfers audio to human agent
  7. Update `ai_voice_sessions.outcome` = 'escalated'

### Step 3.8 - Lead Creation from AI Conversations

- **Trigger:** Voice-bridge callback with `session.ended`
- **Flow:**
  1. Receive full transcript
  2. Generate AI summary using existing Anthropic/OpenAI client
  3. Extract structured data: customer name, phone, vehicle, service requested
  4. Create `call_ai_inquiries` record via existing workflow
  5. If eligible, auto-convert to `leads` record
  6. Link lead to `ai_voice_sessions.call_session_id`

---

## Phase 4: UI Integration

**Goal:** Show AI call status, transcripts, and configuration in the call center UI.

**Estimated Files:** 5 new, 3 modified

### Step 4.1 - AI Sessions API Endpoints

- **Location:** `apps/web/app/api/company/[companyId]/call-center/ai-sessions/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ai-sessions` | GET | List AI voice sessions with filters (date, status, outcome) |
| `/ai-sessions/active` | GET | Get currently active AI sessions |
| `/ai-sessions/[sessionId]` | GET | Session detail with full transcript |
| `/ai-sessions/[sessionId]/transfer` | POST | Manual transfer to agent |
| `/ai-sessions/[sessionId]/stop` | POST | Manual end session |

### Step 4.2 - AI Badge on Call History

- **File:** `apps/web/app/company/[companyId]/call-center/history/page.tsx`
- **Changes:**
  - Join query with `ai_voice_sessions` table
  - Show badge on AI-handled calls: "AI Handled" (green), "AI --> Agent" (blue), "AI Failed" (red)
  - Click badge opens transcript viewer

### Step 4.3 - Active AI Calls Panel

- **File:** `apps/web/app/company/[companyId]/call-center/page.tsx` (main dashboard)
- **Changes:**
  - New "Active AI Calls" section (polls `/ai-sessions/active` every 5s)
  - Shows for each active call:
    - Caller number + matched customer name
    - Duration timer
    - Live transcript (latest 3 messages)
    - "Transfer to Agent" button
    - "End Call" button

### Step 4.4 - AI Session Transcript Viewer

- **File:** `apps/web/app/company/[companyId]/call-center/ai-sessions/[sessionId]/page.tsx` (NEW)
- **Layout:**
  - Header: caller number, duration, outcome badge, date
  - AI-generated summary card
  - Full transcript with:
    - Speaker labels (Caller / AI)
    - Timestamps
    - Function calls highlighted (appointments booked, info collected)
  - Linked inquiry/lead (clickable link)
  - Audio recording player (if available from Yeastar)

### Step 4.5 - Voice Bridge Settings Page

- **File:** `apps/web/app/company/[companyId]/settings/ai/config/page.tsx` (extend existing)
- **New Section: "AI Voice Assistant"**
  - Toggle: Enable/Disable AI voice answering
  - Extension: PBX extension for AI to register as
  - Voice: Dropdown (alloy, echo, nova, shimmer, onyx, fable)
  - Language: Dropdown (en, ar, etc.)
  - Max Duration: Number input (seconds)
  - Welcome Message: Text area
  - System Prompt: Text area (custom AI personality/instructions)
  - Company Context Editor:
    - Services list (add/remove)
    - FAQ pairs (question + answer)
    - Appointment types
  - Escalation Keywords: Tag input
  - Test Call button: Triggers test session for verification

---

## Phase 5: Testing and Verification

**Goal:** Verify end-to-end functionality and harden the system.

### Step 5.1 - Voice Bridge Standalone Test

| Test | Command/Action | Expected Result |
|------|----------------|-----------------|
| Health check | `curl http://localhost:8090/health` | `{ "ok": true, "service": "voice-bridge" }` |
| Start session | `POST /sessions/start` with test params | Session created with state "ready" |
| List sessions | `GET /sessions` | Returns active sessions array |
| Stop session | `POST /sessions/stop` | Session state changes to "stopped" |
| Get transcript | `GET /sessions/:id/transcript` | Returns transcript array |

### Step 5.2 - SIP Registration Test

| Test | Action | Expected Result |
|------|--------|-----------------|
| Extension registration | Start voice-bridge with PBX credentials | Yeastar admin shows extension as "Registered" |
| Re-registration | Wait 60 seconds | Extension stays registered (55s refresh) |
| Auth challenge | Use wrong password | Graceful failure, retry with backoff |

### Step 5.3 - Inbound Call Test

| Test | Action | Expected Result |
|------|--------|-----------------|
| AI answers | Call PBX extension from phone | AI greeting plays within 2 seconds |
| Conversation | Speak to AI | AI responds contextually |
| Transcript | Check `/sessions/:id/transcript` during call | Real-time transcript entries |

### Step 5.4 - ERP Integration Test

| Test | Action | Expected Result |
|------|--------|-----------------|
| Auto-trigger | Call PBX with AI policy enabled | Webhook fires, voice-bridge session starts automatically |
| Session record | Check database | `ai_voice_sessions` row created with correct company_id |
| Transcript storage | Check database after call | `ai_voice_transcripts` rows with full conversation |

### Step 5.5 - Escalation Test

| Test | Action | Expected Result |
|------|--------|-----------------|
| Keyword trigger | Say "transfer me to a human" | AI invokes `escalate_to_agent` function |
| Call transfer | Above triggers Yeastar API | Call transfers to human agent extension |
| Session update | Check database | Session outcome = 'escalated' |

### Step 5.6 - Lead Creation Test

| Test | Action | Expected Result |
|------|--------|-----------------|
| AI call ends | Complete a full AI conversation | `call_ai_inquiries` record created |
| Auto-convert | Inquiry with sufficient data | `leads` record created, linked to inquiry |
| Summary | Check `ai_voice_sessions.transcript_summary` | AI-generated summary present |

### Step 5.7 - UI Verification

| Test | Page | Expected Result |
|------|------|-----------------|
| History badge | Call history page | AI-handled calls show "AI Handled" badge |
| Active panel | Dashboard | Active AI calls appear with live info |
| Transcript viewer | Click AI session | Full transcript with speaker labels |
| Settings | AI config page | Voice bridge settings save and load correctly |

---

## Key Files Reference

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `packages/ai-core/src/voice-bridge/client.ts` | 3 | HTTP client for voice-bridge API |
| `packages/ai-core/src/voice-bridge/instructionBuilder.ts` | 3 | Build AI system prompts |
| `packages/ai-core/src/voice-bridge/repository.ts` | 3 | Database access for AI sessions |
| `apps/web/app/api/webhooks/voice-bridge/events/route.ts` | 3 | Callback receiver from voice-bridge |
| `apps/web/app/api/company/[companyId]/call-center/ai-sessions/route.ts` | 4 | List AI sessions API |
| `apps/web/app/api/company/[companyId]/call-center/ai-sessions/active/route.ts` | 4 | Active sessions API |
| `apps/web/app/api/company/[companyId]/call-center/ai-sessions/[sessionId]/route.ts` | 4 | Session detail API |
| `apps/web/app/company/[companyId]/call-center/ai-sessions/[sessionId]/page.tsx` | 4 | Transcript viewer page |
| `packages/ai-core/migrations/192_ai_voice_sessions.sql` | 2 | AI voice sessions table |
| `packages/ai-core/migrations/193_ai_voice_transcripts.sql` | 2 | AI voice transcripts table |
| `packages/ai-core/migrations/194_ai_voice_policy_extensions.sql` | 2 | Policy extensions |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `apps/voice-bridge/src/openaiRealtime.ts` | 1 | Transcript capture, function calling, whisper |
| `apps/voice-bridge/src/sessionManager.ts` | 1 | Callbacks, timeouts, transcript storage |
| `apps/voice-bridge/src/sipRtpBridge.ts` | 1 | PCMA transcoding, DTMF, inactivity timeout |
| `apps/voice-bridge/src/types.ts` | 1 | Extended types for callbacks and context |
| `apps/voice-bridge/src/index.ts` | 1 | Transcript endpoint |
| `apps/web/app/api/webhooks/dialer/[providerKey]/route.ts` | 3 | Trigger voice-bridge after auto-pickup |
| `packages/ai-core/src/call-center/aiPolicy.ts` | 3 | Voice bridge fields in policy type |
| `apps/web/app/company/[companyId]/call-center/history/page.tsx` | 4 | AI badge on calls |
| `apps/web/app/company/[companyId]/call-center/page.tsx` | 4 | Active AI calls panel |
| `apps/web/app/company/[companyId]/settings/ai/config/page.tsx` | 4 | Voice bridge settings |

---

## Environment Variables

### ERP Web App (`.env`)

```
VOICE_BRIDGE_URL=http://192.168.0.162:8090
VOICE_BRIDGE_API_TOKEN=your-shared-secret
VOICE_BRIDGE_CALLBACK_BASE_URL=https://your-erp-domain.com
```

### Voice Bridge (`apps/voice-bridge/.env`)

```
# Existing (already configured)
VOICE_BRIDGE_PORT=8090
VOICE_BRIDGE_OPENAI_API_KEY=sk-...
VOICE_BRIDGE_PBX_HOST=192.168.50.253
VOICE_BRIDGE_SIP_USERNAME=...
VOICE_BRIDGE_SIP_PASSWORD=...

# New
VOICE_BRIDGE_CALLBACK_TOKEN=your-shared-secret
VOICE_BRIDGE_MAX_SESSION_DURATION_MS=600000
VOICE_BRIDGE_TRANSCRIPT_BATCH_INTERVAL_MS=3000
```

---

## Implementation Priority

```
Phase 1 (Voice Bridge)  -->  Phase 2 (Database)  -->  Phase 3 (Backend)  -->  Phase 4 (UI)  -->  Phase 5 (Testing)
       [Week 1-2]              [Week 2]                 [Week 2-3]             [Week 3-4]          [Week 4]
```

Phase 1 is the critical path - everything else depends on a working voice-bridge with transcript capture and callbacks.