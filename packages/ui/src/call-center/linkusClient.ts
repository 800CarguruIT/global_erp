"use client";

export type LinkusConnectionState =
  | "idle"
  | "unavailable"
  | "connecting"
  | "connected"
  | "error";

export type LinkusStatus = {
  state: LinkusConnectionState;
  message?: string | null;
  extension?: string | null;
};

type LinkusSessionSnapshot = {
  sessionId: string;
  isRing: boolean;
  isHold: boolean;
  callStatus: string;
  remoteNumber: string | null;
  toNumber: string | null;
  callStartTime: number;
  raw: any;
};

type LinkusStatusListener = (status: LinkusStatus) => void;

declare global {
  interface Window {
    LinkusWebRTC?: any;
    LinkusSDK?: any;
    Linkus?: any;
    linkus?: any;
    YSWebRTC?: any;
    __LINKUS_SDK_PLACEHOLDER__?: boolean;
    __linkusDebugLastSession?: any;
    __linkusDebugSessions?: any[];
    __linkusDebugLastStatus?: LinkusStatus;
  }
}

function isSdkLike(value: any): boolean {
  if (!value) return false;
  return (
    typeof value.init === "function" ||
    typeof value.login === "function" ||
    typeof value.connect === "function" ||
    typeof value.answer === "function" ||
    typeof value.pickup === "function"
  );
}

function pickSdk(): { sdk: any | null; source: string; discovered: string[] } {
  if (typeof window === "undefined") return { sdk: null, source: "", discovered: [] };
  const directCandidates: Array<[string, any]> = [
    ["YSWebRTC", (window as any).YSWebRTC],
    ["LinkusWebRTC", window.LinkusWebRTC],
    ["LinkusSDK", window.LinkusSDK],
    ["Linkus", window.Linkus],
    ["linkus", window.linkus],
  ];
  for (const [name, value] of directCandidates) {
    if (isSdkLike(value)) return { sdk: value, source: name, discovered: [name] };
  }

  const discovered = Object.keys(window).filter((key) => /linkus/i.test(key));
  for (const key of discovered) {
    const value = (window as any)[key];
    if (isSdkLike(value)) return { sdk: value, source: key, discovered };
  }

  return { sdk: null, source: "", discovered };
}

async function detectSdkScriptIssue(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (window.__LINKUS_SDK_PLACEHOLDER__) {
    return "SDK placeholder detected (replace /public/linkus-sdk.js with real SDK bundle)";
  }
  const scripts = Array.from(document.scripts || []);
  const sdkScript = scripts.find((script) => {
    const src = String(script.src || "").toLowerCase();
    return src.includes("linkus-sdk.js") || src.includes("linkus");
  });
  if (!sdkScript?.src) return "SDK script tag not found";

  try {
    const scriptUrl = new URL(sdkScript.src, window.location.origin);
    if (scriptUrl.origin !== window.location.origin) {
      return `SDK script loaded from ${scriptUrl.origin}`;
    }
    const res = await fetch(scriptUrl.pathname + scriptUrl.search, { cache: "no-store" });
    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    const body = await res.text();
    const sample = body.slice(0, 120).toLowerCase();
    if (contentType.includes("text/html") || sample.includes("<!doctype html") || sample.includes("<html")) {
      return "SDK file is HTML, not JS (replace /public/linkus-sdk.js with real SDK)";
    }
    return null;
  } catch {
    return null;
  }
}

class LinkusClient {
  private sdk: any | null = null;
  private operator: any | null = null;
  private phone: any | null = null;
  private debugSessionPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastConnectKey: string | null = null;
  private lastFailureAt = 0;
  private status: LinkusStatus = { state: "idle", message: null, extension: null };
  private listeners = new Set<LinkusStatusListener>();

  private writeDebugSnapshot(data: {
    lastSession?: any;
    sessions?: any[];
    status?: LinkusStatus;
  }) {
    if (typeof window === "undefined") return;
    if (Object.prototype.hasOwnProperty.call(data, "lastSession")) {
      window.__linkusDebugLastSession = data.lastSession;
    }
    if (Object.prototype.hasOwnProperty.call(data, "sessions")) {
      window.__linkusDebugSessions = data.sessions ?? [];
    }
    if (Object.prototype.hasOwnProperty.call(data, "status") && data.status) {
      window.__linkusDebugLastStatus = data.status;
    }
  }

  private emit(next: LinkusStatus) {
    this.status = next;
    if (next.state !== "connected") {
      this.stopDebugSessionPolling();
    }
    this.writeDebugSnapshot({ status: next });
    for (const listener of this.listeners) listener(this.status);
  }

  private extractSessionId(session: any): string {
    const raw =
      session?.id ??
      session?.sessionID ??
      session?.sessionId ??
      session?.callId ??
      session?.sipCallId ??
      "";
    return String(raw ?? "").trim();
  }

  private collectRingingSessions(): any[] {
    const list: any[] = [];
    const push = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) {
        for (const item of value) push(item);
        return;
      }
      if (typeof value === "object") list.push(value);
    };
    try {
      push(this.phone?.incomingList);
    } catch {
      // ignore getter failures
    }
    try {
      if (typeof this.phone?.getCurrentSession === "function") {
        push(this.phone.getCurrentSession());
      }
    } catch {
      // ignore getter failures
    }
    try {
      if (typeof this.phone?.getSessions === "function") {
        push(this.phone.getSessions());
      }
    } catch {
      // ignore getter failures
    }
    const unique = new Map<string, any>();
    for (const session of list) {
      const id = this.extractSessionId(session);
      const key = id || `${Object.keys(session).slice(0, 3).join("|")}:${list.indexOf(session)}`;
      if (!unique.has(key)) unique.set(key, session);
    }
    const sessions = Array.from(unique.values());
    this.writeDebugSnapshot({ sessions });
    return sessions;
  }

  private startDebugSessionPolling() {
    this.stopDebugSessionPolling();
    this.debugSessionPollTimer = setInterval(() => {
      try {
        this.collectRingingSessions();
      } catch {
        // ignore polling errors
      }
    }, 1000);
  }

  private stopDebugSessionPolling() {
    if (this.debugSessionPollTimer) {
      clearInterval(this.debugSessionPollTimer);
      this.debugSessionPollTimer = null;
    }
  }

  /**
   * Attach a remote MediaStream to a persistent <audio> element so the user
   * can hear the other party. The element is created once and reused across calls.
   * We never remove it from the DOM so the AudioContext used by WebRTC is not disrupted.
   */
  private attachRemoteStream(stream: MediaStream) {
    if (typeof document === "undefined") return;
    const AUDIO_ID = "__linkus_remote_audio__";
    let audio = document.getElementById(AUDIO_ID) as HTMLAudioElement | null;
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = AUDIO_ID;
      audio.autoplay = true;
      audio.style.display = "none";
      document.body.appendChild(audio);
    }
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
      audio.play().catch(() => {/* autoplay policy — browser will play when allowed */});
    }
  }

  /**
   * Patch RTCPeerConnection once at the global level so that every peer connection
   * the SDK creates — regardless of internal event names — automatically routes
   * incoming audio tracks to the speaker.
   *
   * This is more reliable than subscribing to SDK-specific events because it works
   * with any SDK version or wrapper layer.
   */
  patchRTCPeerConnection() {
    if (typeof window === "undefined" || !window.RTCPeerConnection) return;
    if ((window as any).__linkusRTCPatched) return;
    (window as any).__linkusRTCPatched = true;

    const OrigPC = window.RTCPeerConnection;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const client = this;

    function PatchedPC(this: RTCPeerConnection, ...args: ConstructorParameters<typeof RTCPeerConnection>) {
      const pc: RTCPeerConnection = new OrigPC(...args);
      pc.addEventListener("track", (e: RTCTrackEvent) => {
        if (e.track.kind === "audio") {
          const stream = e.streams?.[0] ?? new MediaStream([e.track]);
          client.attachRemoteStream(stream);
        }
      });
      return pc;
    }
    PatchedPC.prototype = OrigPC.prototype;
    (PatchedPC as any).generateCertificate = OrigPC.generateCertificate?.bind(OrigPC);
    window.RTCPeerConnection = PatchedPC as unknown as typeof RTCPeerConnection;
  }

  private hookRemoteAudio(target: any) {
    // No-op — patchRTCPeerConnection handles all cases at the constructor level.
    void target;
  }

  private normalizeMaybePhone(value: unknown): string | null {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const hasPlus = raw.startsWith("+");
    const digits = raw.replace(/\D+/g, "");
    if (!digits) return null;
    return hasPlus ? `+${digits}` : digits;
  }

  private isLikelyExternal(value: string | null): boolean {
    if (!value) return false;
    const digits = value.replace(/\D+/g, "");
    return digits.length >= 7;
  }

  private getSessionSnapshot(session: any): LinkusSessionSnapshot {
    const status = session?.status ?? {};
    const sessionId = this.extractSessionId(session);
    const remoteCandidates = [
      status?.number,
      status?.remoteNumber,
      session?.remote_identity?.uri?.user,
      session?.remoteIdentity?.uri?.user,
      session?.number,
      session?.from,
      session?.caller,
    ];
    const toCandidates = [
      status?.toNumber,
      status?.calleeNumber,
      session?.local_identity?.uri?.user,
      session?.localIdentity?.uri?.user,
      session?.to,
      session?.callee,
    ];
    const remoteNumber =
      remoteCandidates
        .map((v) => this.normalizeMaybePhone(v))
        .find((v) => this.isLikelyExternal(v ?? null)) ?? null;
    const toNumber = toCandidates.map((v) => this.normalizeMaybePhone(v)).find(Boolean) ?? null;
    const isRing = Boolean(status?.isRing);
    const isHold = Boolean(status?.isHold);
    const callStatus = String(status?.callStatus ?? "").trim().toLowerCase();
    const callStartTime = Number(status?.callStartTime ?? 0) || 0;
    return {
      sessionId,
      isRing,
      isHold,
      callStatus,
      remoteNumber,
      toNumber,
      callStartTime,
      raw: session,
    };
  }

  getSessionsSnapshot(): LinkusSessionSnapshot[] {
    const sessions = this.collectRingingSessions();
    return sessions.map((session) => this.getSessionSnapshot(session));
  }

  private normalizeMatchToken(value: string | null | undefined): string {
    return this.normalizeMaybePhone(value) ?? "";
  }

  private findSession(callId?: string | null, toNumber?: string | null): any | null {
    const normalizedCallId = String(callId ?? "").trim();
    const normalizedTo = this.normalizeMatchToken(toNumber);
    const sessions = this.collectRingingSessions();
    if (!sessions.length) return null;
    if (normalizedCallId) {
      const direct = sessions.find((session) => this.extractSessionId(session) === normalizedCallId);
      if (direct) return direct;
    }
    if (normalizedTo) {
      const matchTo = sessions.find((session) => {
        const snap = this.getSessionSnapshot(session);
        return this.normalizeMatchToken(snap.toNumber) === normalizedTo;
      });
      if (matchTo) return matchTo;
    }
    return sessions[0] ?? null;
  }

  private async callMethod(
    target: any,
    methodName: string,
    argsWithId: Array<unknown>,
    argsNoId: Array<unknown>
  ): Promise<boolean> {
    if (!target || typeof target[methodName] !== "function") return false;
    try {
      if (argsWithId.length > 0) {
        await target[methodName](...argsWithId);
      } else {
        await target[methodName](...argsNoId);
      }
      return true;
    } catch {
      try {
        await target[methodName](...argsNoId);
        return true;
      } catch {
        return false;
      }
    }
  }

  getBestCallerNumber(hint?: { toNumber?: string | null; callId?: string | null }): string | null {
    const sessions = this.collectRingingSessions();
    if (!sessions.length) return null;
    const snapshots = sessions.map((s) => this.getSessionSnapshot(s));
    const hintedCallId = String(hint?.callId ?? "").trim();
    const hintedTo = this.normalizeMaybePhone(hint?.toNumber ?? null);

    const byHintedCall = hintedCallId
      ? snapshots.find((s) => s.sessionId && s.sessionId === hintedCallId)
      : null;
    if (byHintedCall?.remoteNumber) return byHintedCall.remoteNumber;

    const byHintedTo = hintedTo
      ? snapshots.find((s) => s.toNumber && this.normalizeMaybePhone(s.toNumber) === hintedTo)
      : null;
    if (byHintedTo?.remoteNumber) return byHintedTo.remoteNumber;

    const ranked = [...snapshots].sort((a, b) => {
      if (a.isRing !== b.isRing) return a.isRing ? -1 : 1;
      const aTalking = a.callStatus === "talking";
      const bTalking = b.callStatus === "talking";
      if (aTalking !== bTalking) return aTalking ? -1 : 1;
      return b.callStartTime - a.callStartTime;
    });
    const best = ranked.find((s) => s.remoteNumber);
    return best?.remoteNumber ?? null;
  }

  getStatus(): LinkusStatus {
    return this.status;
  }

  subscribe(listener: LinkusStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  async connect(args: {
    extension?: string | null;
    password?: string | null;
    token?: string | null;
    serverUrl?: string | null;
  }): Promise<LinkusStatus> {
    const extension = String(args.extension ?? "").trim();
    if (!extension) {
      this.emit({
        state: "idle",
        message: "Extension missing (set localStorage dialer_agent_extension)",
        extension: null,
      });
      return this.status;
    }

    const picked = pickSdk();
    const sdk = picked?.sdk ?? null;
    if (!sdk) {
      const scriptIssue = await detectSdkScriptIssue();
      const discoveredText =
        picked?.discovered && picked.discovered.length > 0
          ? `; discovered globals: ${picked.discovered.join(", ")}`
          : "";
      this.emit({
        state: "unavailable",
        message: `Linkus SDK not loaded in browser${
          scriptIssue ? `; ${scriptIssue}` : ""
        }${discoveredText}`,
        extension,
      });
      return this.status;
    }

    // Patch RTCPeerConnection before the SDK initializes so every peer connection
    // it creates automatically routes incoming audio to the browser speaker.
    this.patchRTCPeerConnection();

    this.sdk = sdk;
    this.operator = null;
    this.phone = null;
    this.stopDebugSessionPolling();
    this.emit({
      state: "connecting",
      message: picked?.source ? `SDK source: ${picked.source}` : null,
      extension,
    });

    try {
      const token = String(args.token ?? "").trim();
      const password = String(args.password ?? "").trim();
      const serverUrl = String(args.serverUrl ?? "").trim();
      const secret = token || password;
      const connectKey = [extension, serverUrl, secret].join("|");
      this.lastConnectKey = connectKey;
      const now = Date.now();
      if (
        this.lastConnectKey === connectKey &&
        this.lastFailureAt > 0 &&
        now - this.lastFailureAt < 30000
      ) {
        this.emit({
          state: "error",
          message: "Recent SDK login failure; waiting before retry",
          extension,
        });
        return this.status;
      }

      if (typeof sdk.init === "function") {
        if (!serverUrl) {
          this.emit({
            state: "error",
            message: "dialer_linkus_server missing for YSWebRTC.init",
            extension,
          });
          return this.status;
        }
        if (!secret) {
          this.emit({
            state: "error",
            message: "dialer_linkus_token or dialer_linkus_password missing for YSWebRTC.init",
            extension,
          });
          return this.status;
        }
        const op = await sdk.init({
          username: extension,
          secret,
          pbxURL: serverUrl,
          userAgent: "WebClient",
        });
        this.lastConnectKey = connectKey;
        this.lastFailureAt = 0;
        this.operator = op ?? null;
        this.phone = op?.phone ?? null;
        if (this.phone && typeof this.phone.start === "function") {
          this.phone.start();
        }
        // Hook remote audio on both operator and phone so incoming audio plays.
        this.hookRemoteAudio(this.operator);
        this.hookRemoteAudio(this.phone);
      } else if (typeof sdk.login === "function") {
        await sdk.login({
          ...(serverUrl ? { server: serverUrl } : {}),
          extension,
          ...(token ? { token } : password ? { password } : {}),
        });
        this.hookRemoteAudio(sdk);
      } else if (typeof sdk.connect === "function") {
        await sdk.connect({
          ...(serverUrl ? { server: serverUrl } : {}),
          extension,
          ...(token ? { token } : password ? { password } : {}),
        });
        this.hookRemoteAudio(sdk);
      }

      this.emit({ state: "connected", message: null, extension });
      this.collectRingingSessions();
      this.startDebugSessionPolling();
      return this.status;
    } catch (err: any) {
      this.lastFailureAt = Date.now();
      this.emit({
        state: "error",
        message: err?.message ?? "Linkus connection failed",
        extension,
      });
      return this.status;
    }
  }

  async answer(callId?: string | null): Promise<boolean> {
    if (!this.sdk) return false;
    const normalizedCallId = String(callId ?? "").trim();
    const setCurrentSession = (session: any) => {
      const sessionId = this.extractSessionId(session);
      if (!sessionId) return;
      try {
        if (typeof this.phone?.setCurrentSession === "function") {
          this.phone.setCurrentSession(sessionId);
        }
      } catch {
        // ignore
      }
    };

    const tryInvoke = async (
      target: any,
      methodName: "answer" | "pickup" | "accept",
      passCallId: boolean
    ): Promise<boolean> => {
      if (!target || typeof target[methodName] !== "function") return false;
      try {
        if (passCallId && normalizedCallId) {
          await target[methodName](normalizedCallId);
        } else {
          await target[methodName]();
        }
        return true;
      } catch {
        return false;
      }
    };

    try {
      const sessions = this.collectRingingSessions();
      for (const session of sessions) {
        this.hookRemoteAudio(session);
        this.writeDebugSnapshot({ lastSession: session, sessions });
        setCurrentSession(session);
        const okSessionAnswer = await tryInvoke(session, "answer", true);
        if (okSessionAnswer) return true;
        const okSessionAccept = await tryInvoke(session, "accept", true);
        if (okSessionAccept) return true;
        const okSessionPickup = await tryInvoke(session, "pickup", true);
        if (okSessionPickup) return true;
        const okSessionAnswerNoId = await tryInvoke(session, "answer", false);
        if (okSessionAnswerNoId) return true;
        const okSessionAcceptNoId = await tryInvoke(session, "accept", false);
        if (okSessionAcceptNoId) return true;
        const okSessionPickupNoId = await tryInvoke(session, "pickup", false);
        if (okSessionPickupNoId) return true;
      }

      const targets = [this.phone, this.operator, this.sdk];
      const attempts: Array<{ method: "answer" | "pickup" | "accept"; withId: boolean }> = [
        { method: "answer", withId: true },
        { method: "pickup", withId: true },
        { method: "accept", withId: true },
        { method: "answer", withId: false },
        { method: "pickup", withId: false },
        { method: "accept", withId: false },
      ];

      for (const target of targets) {
        for (const attempt of attempts) {
          const ok = await tryInvoke(target, attempt.method, attempt.withId);
          if (ok) return true;
        }
      }

      this.emit({
        state: "error",
        message: `SDK answer failed (no compatible ringing session; sessions=${sessions.length})`,
        extension: this.status.extension ?? null,
      });
      return false;
    } catch (err: any) {
      this.emit({
        state: "error",
        message: err?.message ?? "SDK answer failed",
        extension: this.status.extension ?? null,
      });
      return false;
    }
  }

  async hang(callId?: string | null, toNumber?: string | null): Promise<boolean> {
    if (!this.sdk) return false;
    const normalizedCallId = String(callId ?? "").trim();
    const session = this.findSession(normalizedCallId, toNumber);
    const targets = [session, this.phone, this.operator, this.sdk];
    const methods = ["terminate", "hangup", "bye", "end", "reject"];
    for (const target of targets) {
      for (const methodName of methods) {
        const ok = await this.callMethod(
          target,
          methodName,
          normalizedCallId ? [normalizedCallId] : [],
          []
        );
        if (ok) return true;
      }
    }
    this.emit({
      state: "error",
      message: "SDK hang failed",
      extension: this.status.extension ?? null,
    });
    return false;
  }

  async dial(toNumber: string): Promise<boolean> {
    if (!this.phone && !this.operator && !this.sdk) return false;
    const normalized = toNumber.trim();
    if (!normalized) return false;
    const methods = ["call", "makeCall", "dial", "startCall", "invite"];
    const targets = [this.phone, this.operator, this.sdk];
    for (const target of targets) {
      for (const method of methods) {
        if (target && typeof target[method] === "function") {
          try {
            const result = await target[method](normalized);
            // Hook remote audio on the returned session (if any) so the user
            // can hear the remote party once they answer.
            this.hookRemoteAudio(result);
            this.hookRemoteAudio(target);
            return true;
          } catch {
            // try next
          }
        }
      }
    }
    this.emit({
      state: "error",
      message: `SDK dial failed for ${normalized} (no compatible dial method found)`,
      extension: this.status.extension ?? null,
    });
    return false;
  }

  async setHold(
    callId?: string | null,
    toNumber?: string | null,
    hold = true
  ): Promise<boolean> {
    if (!this.sdk) return false;
    const normalizedCallId = String(callId ?? "").trim();
    const session = this.findSession(normalizedCallId, toNumber);
    const targets = [session, this.phone, this.operator, this.sdk];
    const methods = hold ? ["hold"] : ["unhold", "resume", "unHold"];
    for (const target of targets) {
      for (const methodName of methods) {
        const ok = await this.callMethod(
          target,
          methodName,
          normalizedCallId ? [normalizedCallId] : [],
          []
        );
        if (ok) return true;
      }
    }
    this.emit({
      state: "error",
      message: hold ? "SDK hold failed" : "SDK resume failed",
      extension: this.status.extension ?? null,
    });
    return false;
  }
}

let singleton: LinkusClient | null = null;

export function getLinkusClient(): LinkusClient {
  if (!singleton) singleton = new LinkusClient();
  return singleton;
}
