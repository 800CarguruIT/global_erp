<?php

function yeastar_get_config()
{
    static $config = null;
    if ($config === null) {
        $config = include __DIR__ . '/config.php';
    }
    return $config;
}

function yeastar_log($message, array $context = [])
{
    $cfg = yeastar_get_config();
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $message;
    if (!empty($context)) {
        $line .= ' ' . json_encode($context);
    }
    $line .= PHP_EOL;
    @file_put_contents($cfg['LOG_FILE'], $line, FILE_APPEND);
}

function yeastar_json_response($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function yeastar_get_bearer_token()
{
    $header = yeastar_get_header_value('Authorization');

    if (!$header) {
        return '';
    }

    if (stripos($header, 'Bearer ') !== 0) {
        return '';
    }

    return trim(substr($header, 7));
}

function yeastar_get_header_value($headerName)
{
    $headerName = trim((string)$headerName);
    if ($headerName === '') {
        return '';
    }

    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $headerName));
    $redirectKey = 'REDIRECT_' . $serverKey;

    if (isset($_SERVER[$serverKey])) {
        return (string)$_SERVER[$serverKey];
    }
    if (isset($_SERVER[$redirectKey])) {
        return (string)$_SERVER[$redirectKey];
    }
    if (isset($_SERVER[$headerName])) {
        return (string)$_SERVER[$headerName];
    }

    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            foreach ($headers as $key => $value) {
                if (strcasecmp((string)$key, $headerName) === 0) {
                    return (string)$value;
                }
            }
        }
    }

    return '';
}

function yeastar_require_webhook_auth($rawBody = '')
{
    $cfg = yeastar_get_config();
    $secret = (string)($cfg['YEASTAR_WEBHOOK_SECRET'] ?? '');
    if ($secret !== '') {
        $provided = yeastar_get_first_signature_header();
        $computedRaw = hash_hmac('sha256', (string)$rawBody, $secret, true);
        $computedBase64 = base64_encode($computedRaw);
        $computedHex = hash_hmac('sha256', (string)$rawBody, $secret);
        $providedClean = trim((string)$provided);
        if (stripos($providedClean, 'sha256=') === 0) {
            $providedClean = substr($providedClean, 7);
        }

        $matches = false;
        if ($providedClean !== '') {
            $matches = hash_equals($computedBase64, $providedClean)
                || hash_equals($computedHex, strtolower($providedClean));
        }

        if (!$matches) {
            yeastar_log('webhook_signature_failed', [
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                'has_signature' => $provided !== '',
            ]);
            yeastar_json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
        }
        return;
    }

    yeastar_require_auth();
}

function yeastar_get_first_signature_header()
{
    $headers = [
        'X-Signature',
        'Signature',
        'X-Yeastar-Signature',
        'X-Webhook-Signature',
        'X-Hub-Signature-256',
        'X-Hmac-SHA256',
    ];

    foreach ($headers as $header) {
        $value = trim(yeastar_get_header_value($header));
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function yeastar_require_auth()
{
    $cfg = yeastar_get_config();
    $expected = (string)($cfg['YEASTAR_WEBHOOK_TOKEN'] ?? '');
    if ($expected === '') {
        return;
    }

    $provided = yeastar_get_bearer_token();
    if (!hash_equals($expected, $provided)) {
        yeastar_log('auth_failed', ['ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
        yeastar_json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
    }
}

function yeastar_parse_json_body($raw = null)
{
    if ($raw === null) {
        $raw = file_get_contents('php://input');
    }
    if (!$raw) {
        if (!empty($_POST) && is_array($_POST)) {
            return $_POST;
        }
        return [];
    }
    $data = json_decode($raw, true);
    if (is_array($data)) {
        return $data;
    }

    $form = [];
    parse_str($raw, $form);
    if (is_array($form) && !empty($form)) {
        foreach (['data', 'payload', 'body'] as $k) {
            if (isset($form[$k]) && is_string($form[$k])) {
                $nested = json_decode($form[$k], true);
                if (is_array($nested)) {
                    $form[$k] = $nested;
                }
            }
        }
        return $form;
    }

    if (!empty($_POST) && is_array($_POST)) {
        return $_POST;
    }

    return [];
}

function yeastar_pick_first(array $source, array $keys, $default = '')
{
    foreach ($keys as $key) {
        if (isset($source[$key]) && $source[$key] !== null && $source[$key] !== '') {
            return $source[$key];
        }
    }
    return $default;
}

function yeastar_normalize_phone($phone)
{
    $phone = trim((string)$phone);
    if ($phone === '') {
        return '';
    }

    $has_plus = strpos($phone, '+') === 0;
    $digits = preg_replace('/\D+/', '', $phone);
    if ($digits === '') {
        return '';
    }

    return $has_plus ? ('+' . $digits) : $digits;
}

function yeastar_last_digits($phone, $n = 9)
{
    $digits = preg_replace('/\D+/', '', (string)$phone);
    if ($digits === '') {
        return '';
    }
    if (strlen($digits) <= $n) {
        return $digits;
    }
    return substr($digits, -$n);
}

function yeastar_ensure_runtime_dirs()
{
    $cfg = yeastar_get_config();
    if (!is_dir($cfg['SSE_DIR'])) {
        @mkdir($cfg['SSE_DIR'], 0775, true);
    }
    $runtimeDir = dirname($cfg['LOG_FILE']);
    if (!is_dir($runtimeDir)) {
        @mkdir($runtimeDir, 0775, true);
    }
}

function yeastar_queue_file($extension)
{
    $cfg = yeastar_get_config();
    $safeExt = preg_replace('/[^0-9A-Za-z_\-]/', '', (string)$extension);
    if ($safeExt === '') {
        $safeExt = 'unknown';
    }
    return rtrim($cfg['SSE_DIR'], '/\\') . DIRECTORY_SEPARATOR . $safeExt . '.jsonl';
}

function yeastar_push_event($extension, array $event)
{
    $file = yeastar_queue_file($extension);
    $line = json_encode($event) . PHP_EOL;
    @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
}

function yeastar_ws_publish(array $event)
{
    $cfg = yeastar_get_config();
    if (empty($cfg['YEASTAR_WS_PUSH_ENABLED'])) {
        return false;
    }

    $url = (string)($cfg['YEASTAR_WS_PUSH_URL'] ?? '');
    if ($url === '') {
        return false;
    }

    $json = json_encode($event);
    if ($json === false) {
        return false;
    }

    $headers = [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($json),
    ];

    $token = (string)($cfg['YEASTAR_WS_PUSH_TOKEN'] ?? '');
    if ($token !== '') {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT_MS => 400,
            CURLOPT_TIMEOUT_MS => 900,
        ]);
        curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code >= 200 && $code < 300;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $json,
            'timeout' => 1,
            'ignore_errors' => true,
        ]
    ]);
    $result = @file_get_contents($url, false, $context);
    return $result !== false;
}

function yeastar_pop_events($extension)
{
    $file = yeastar_queue_file($extension);
    if (!file_exists($file)) {
        return [];
    }

    $events = [];
    $fp = fopen($file, 'c+');
    if (!$fp) {
        return [];
    }

    if (flock($fp, LOCK_EX)) {
        $content = stream_get_contents($fp);
        $now = time();
        $maxAgeSeconds = 120;
        $linesToKeep = [];

        if ($content !== false && $content !== '') {
            $lines = explode(PHP_EOL, trim($content));
            foreach ($lines as $line) {
                $decoded = json_decode($line, true);
                if (!is_array($decoded)) {
                    continue;
                }

                $receivedAt = isset($decoded['received_at']) ? strtotime((string)$decoded['received_at']) : false;
                if ($receivedAt !== false && ($now - $receivedAt) > $maxAgeSeconds) {
                    continue;
                }

                $events[] = $decoded;
                $linesToKeep[] = json_encode($decoded);
            }
        }

        // Keep recent events for a short window so parallel tabs/sessions can still receive popup data.
        $newContent = '';
        if (!empty($linesToKeep)) {
            $newContent = implode(PHP_EOL, $linesToKeep) . PHP_EOL;
        }
        ftruncate($fp, 0);
        rewind($fp);
        if ($newContent !== '') {
            fwrite($fp, $newContent);
        }
        flock($fp, LOCK_UN);
    }

    fclose($fp);
    return $events;
}

function yeastar_http_request($method, $url, $headers = [], $body = '')
{
    $method = strtoupper((string)$method);
    $headers = is_array($headers) ? $headers : [];
    $body = (string)$body;
    $cfg = yeastar_get_config();
    $sslVerify = isset($cfg['YEASTAR_API_SSL_VERIFY']) ? (bool)$cfg['YEASTAR_API_SSL_VERIFY'] : true;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_SSL_VERIFYPEER => $sslVerify,
            CURLOPT_SSL_VERIFYHOST => $sslVerify ? 2 : 0,
        ]);
        $respBody = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        return [
            'status' => $status,
            'body' => $respBody === false ? '' : $respBody,
            'error' => $err,
        ];
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $body,
            'timeout' => 20,
            'ignore_errors' => true,
        ]
    ]);
    $respBody = @file_get_contents($url, false, $context);
    return [
        'status' => 200,
        'body' => $respBody === false ? '' : $respBody,
        'error' => $respBody === false ? 'request_failed' : '',
    ];
}

function yeastar_normalize_extension($ext)
{
    $ext = trim((string)$ext);
    return preg_replace('/[^0-9A-Za-z_\-]/', '', $ext);
}

function yeastar_get_openapi_base()
{
    $cfg = yeastar_get_config();
    $base = rtrim((string)($cfg['YEASTAR_API_BASE_URL'] ?? ''), '/');
    $path = trim((string)($cfg['YEASTAR_API_PATH'] ?? 'openapi/v1.0'), '/');
    if ($base === '') {
        return '';
    }
    return $base . '/' . $path;
}

function yeastar_token_cache_read()
{
    $cfg = yeastar_get_config();
    $file = (string)($cfg['YEASTAR_API_TOKEN_CACHE_FILE'] ?? '');
    if ($file === '' || !file_exists($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function yeastar_token_cache_write(array $data)
{
    $cfg = yeastar_get_config();
    $file = (string)($cfg['YEASTAR_API_TOKEN_CACHE_FILE'] ?? '');
    if ($file === '') {
        return;
    }
    $dir = dirname($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    @file_put_contents($file, json_encode($data), LOCK_EX);
}

function yeastar_token_cache_clear()
{
    $cfg = yeastar_get_config();
    $file = (string)($cfg['YEASTAR_API_TOKEN_CACHE_FILE'] ?? '');
    if ($file === '') {
        return;
    }
    if (file_exists($file)) {
        @unlink($file);
    }
}

function yeastar_get_openapi_token()
{
    $cfg = yeastar_get_config();
    $base = yeastar_get_openapi_base();
    $clientId = trim((string)($cfg['YEASTAR_API_CLIENT_ID'] ?? ''));
    $clientSecret = trim((string)($cfg['YEASTAR_API_CLIENT_SECRET'] ?? ''));
    $username = trim((string)($cfg['YEASTAR_API_USERNAME'] ?? ''));
    $password = trim((string)($cfg['YEASTAR_API_PASSWORD'] ?? ''));
    $userAgent = trim((string)($cfg['YEASTAR_API_USER_AGENT'] ?? 'OpenAPI'));

    if ($base === '') {
        return ['ok' => false, 'error' => 'Yeastar API config missing'];
    }
    if (($username === '' || $password === '') && ($clientId === '' || $clientSecret === '')) {
        return ['ok' => false, 'error' => 'Yeastar API credentials missing'];
    }

    $cache = yeastar_token_cache_read();
    if (!empty($cache['access_token']) && !empty($cache['expires_at']) && (int)$cache['expires_at'] > (time() + 60)) {
        return ['ok' => true, 'token' => (string)$cache['access_token']];
    }

    $tokenUrl = $base . '/get_token';
    $payloadData = [];
    if ($username !== '' && $password !== '') {
        $payloadData['username'] = $username;
        $payloadData['password'] = $password;
    } else {
        $payloadData['client_id'] = $clientId;
        $payloadData['client_secret'] = $clientSecret;
    }
    $payloadData['user_agent'] = $userAgent;
    $payload = json_encode($payloadData);
    $resp = yeastar_http_request('POST', $tokenUrl, [
        'Content-Type: application/json',
        'Accept: application/json',
        'User-Agent: ' . $userAgent,
    ], $payload);

    $data = json_decode((string)$resp['body'], true);
    if (!is_array($data) || (int)($data['errcode'] ?? -1) !== 0 || empty($data['access_token'])) {
        yeastar_log('openapi_get_token_failed', [
            'status' => $resp['status'],
            'error' => $resp['error'],
            'response' => $resp['body'],
        ]);
        return ['ok' => false, 'error' => 'Failed to get Yeastar token', 'raw' => $data];
    }

    $expiresIn = (int)($data['expires_in'] ?? 3600);
    $token = (string)$data['access_token'];
    yeastar_token_cache_write([
        'access_token' => $token,
        'expires_at' => time() + $expiresIn,
    ]);

    return ['ok' => true, 'token' => $token];
}

function yeastar_openapi_dial($caller, $callee)
{
    $cfg = yeastar_get_config();
    $base = yeastar_get_openapi_base();
    $userAgent = trim((string)($cfg['YEASTAR_API_USER_AGENT'] ?? 'OpenAPI'));
    $dialPermission = trim((string)($cfg['YEASTAR_API_DIAL_PERMISSION'] ?? ''));
    $autoAnswer = trim((string)($cfg['YEASTAR_API_AUTO_ANSWER'] ?? 'yes'));

    $caller = yeastar_normalize_extension($caller);
    $callee = yeastar_normalize_phone($callee);
    if ($caller === '' || $callee === '') {
        return ['ok' => false, 'error' => 'Missing caller/callee'];
    }
    if ($base === '') {
        return ['ok' => false, 'error' => 'Yeastar API base URL missing'];
    }

    $tokenRes = yeastar_get_openapi_token();
    if (empty($tokenRes['ok'])) {
        return [
            'ok' => false,
            'error' => $tokenRes['error'] ?? 'Token error',
            'token_raw' => $tokenRes['raw'] ?? null,
        ];
    }
    $token = (string)$tokenRes['token'];

    $payload = [
        'caller' => $caller,
        'callee' => $callee,
        'auto_answer' => ($autoAnswer === 'no' ? 'no' : 'yes'),
    ];
    if ($dialPermission !== '') {
        $payload['outbound_params'] = ['dial_permission' => $dialPermission];
    }

    $dialRequest = function ($authToken) use ($base, $userAgent, $payload) {
        $resp = yeastar_http_request(
            'POST',
            $base . '/call/dial',
            [
                'Content-Type: application/json',
                'Accept: application/json',
                'Authorization: ' . $authToken,
                'User-Agent: ' . $userAgent,
            ],
            json_encode($payload)
        );
        $data = json_decode((string)$resp['body'], true);
        return [$resp, $data];
    };

    list($resp, $data) = $dialRequest($token);

    // If token is invalid/expired in PBX side, refresh once and retry.
    if (is_array($data) && (int)($data['errcode'] ?? -1) === 10004) {
        yeastar_token_cache_clear();
        $tokenRes2 = yeastar_get_openapi_token();
        if (!empty($tokenRes2['ok'])) {
            list($resp, $data) = $dialRequest((string)$tokenRes2['token']);
        }
    }

    if (!is_array($data) || (int)($data['errcode'] ?? -1) !== 0) {
        yeastar_log('openapi_dial_failed', [
            'status' => $resp['status'],
            'caller' => $caller,
            'callee' => $callee,
            'response' => $resp['body'],
        ]);
        return ['ok' => false, 'error' => 'Dial failed', 'raw' => $data];
    }

    yeastar_log('openapi_dial_ok', [
        'caller' => $caller,
        'callee' => $callee,
    ]);
    return ['ok' => true, 'response' => $data];
}
