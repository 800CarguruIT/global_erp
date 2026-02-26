# Yeastar Incoming Call Popup Draft

This is a draft integration to replicate your current FreeSWITCH popup flow using Yeastar events.

## Flow

1. Yeastar sends call events to `YeastarIntegration/webhook.php`.
2. `webhook.php` resolves customer info from DB by caller number.
3. Event is queued per extension in `YeastarIntegration/runtime/sse/{extension}.jsonl`.
4. Agent browser listens to `YeastarIntegration/sse.php?extension=1001`.
5. Browser shows popup using `YeastarIntegration/popup.js`.

## Why SSE (not WebSocket)

- For popup-only inbound notifications, SSE is enough.
- No Node process required.
- Fits current PHP/XAMPP stack.

Use WebSocket only if you need bi-directional agent controls (transfer, hangup, live status updates).

## Files

- `YeastarIntegration/config.php`
- `YeastarIntegration/helpers.php`
- `YeastarIntegration/webhook.php`
- `YeastarIntegration/sse.php`
- `YeastarIntegration/popup.js`
- `YeastarIntegration/runtime/.gitignore`

## Setup

1. Edit `YeastarIntegration/config.php`:
   - `YEASTAR_WEBHOOK_TOKEN`
   - `YEASTAR_WEBHOOK_SECRET` (for API Webhook Event Push `X-Signature` verification)
   - `YEASTAR_WS_PUSH_ENABLED` (`true` to enable WebSocket push)
   - `YEASTAR_WS_PUSH_URL` (default `http://127.0.0.1:5190/push`)
   - `YEASTAR_WS_PUSH_TOKEN` (must match WebSocket bridge token)
   - Optional `YEASTAR_DEFAULT_EXTENSION` if payload does not include extension.
2. Make sure web server can write to `YeastarIntegration/runtime/sse`.
3. Configure Yeastar event callback URL:
   - `https://<your-domain>/CG2/YeastarIntegration/webhook.php`
4. Pass Bearer token from Yeastar:
   - `Authorization: Bearer <YEASTAR_WEBHOOK_TOKEN>`
   - (Used for CRM/webhook setups that support custom Authorization header)
5. For API Webhook Event Push, Yeastar sends `X-Signature`; this project validates it with `YEASTAR_WEBHOOK_SECRET`.
6. `includes/footer.php` auto-initializes Yeastar popup for logged-in users with `$_SESSION['extension']`.

## WebSocket Bridge (Recommended)

SSE remains available as fallback, but WebSocket is primary for better real-time stability.

Run the bridge server:

```bash
node YeastarIntegration/ws-server.js
```

Bridge config is file-based in `YeastarIntegration/ws-config.json`:
- `port` (default `5190`)
- `pushToken` (required for `/push`)

`webhook.php` pushes incoming-call events to:

- `YEASTAR_WS_PUSH_URL` (default `http://127.0.0.1:5190/push`)

## Frontend Usage

Add this to the page where agent should get popups:

```html
<script src="/YeastarIntegration/popup.js"></script>
<script>
  startYeastarPopup({
    extension: "1001",
    streamUrl: "/CG2/YeastarIntegration/sse.php",
    customerUrlBase: "/CG2/Accounts/pages/customer.php"
  });
</script>
```

You can set extension dynamically from session/user profile.

## Yeastar Payload Notes

`webhook.php` accepts flexible payload keys. It tries these keys:

- `event`, `event_name`, `type`
- `call_id`, `unique_id`, `id`
- `direction`
- `from_number`, `caller_number`, `caller`, `from`
- `to_number`, `callee_number`, `callee`, `to`
- `extension`, `ext`, `agent_extension`

## Quick Test

```bash
curl -X POST "http://localhost/CG2/YeastarIntegration/webhook.php" \
  -H "Authorization: Bearer <YEASTAR_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"incoming_call\",\"call_id\":\"ys_123\",\"from_number\":\"+971500000000\",\"to_number\":\"1001\",\"extension\":\"1001\"}"
```

Then open a page with `startYeastarPopup({ extension: "1001" ... })`.
