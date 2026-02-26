<?php
session_start();
ob_start();

require_once __DIR__ . '/helpers.php';
include __DIR__ . '/../includes/db_handler/connect.php';

yeastar_ensure_runtime_dirs();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    yeastar_json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false) {
    $rawBody = '';
}
yeastar_require_webhook_auth($rawBody);
@file_put_contents(__DIR__ . '/runtime/webhook-raw.log', '[' . date('Y-m-d H:i:s') . '] ' . $rawBody . PHP_EOL, FILE_APPEND);
yeastar_log('webhook_received_meta', [
    'content_type' => $_SERVER['CONTENT_TYPE'] ?? '',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
]);

$extractRaw = function ($pattern) use ($rawBody) {
    if (!is_string($rawBody) || $rawBody === '') {
        return '';
    }
    if (preg_match($pattern, $rawBody, $m) && isset($m[1])) {
        return (string)$m[1];
    }
    return '';
};


$conn = carguruDB();
$cfg = yeastar_get_config();
$payload = yeastar_parse_json_body($rawBody);

$sources = [];
$stack = [$payload];
while (!empty($stack)) {
    $node = array_pop($stack);
    if (!is_array($node)) {
        continue;
    }

    $sources[] = $node;
    foreach ($node as $value) {
        if (is_array($value)) {
            $stack[] = $value;
            continue;
        }
        if (!is_string($value)) {
            continue;
        }
        $trimmed = trim($value);
        if ($trimmed === '') {
            continue;
        }
        if (($trimmed[0] === '{' || $trimmed[0] === '[')) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                $stack[] = $decoded;
            }
        }
    }
}

$pickDeep = function (array $keys, $default = '') use ($sources) {
    $keysLower = array_map('strtolower', $keys);
    $scan = function ($node) use (&$scan, $keysLower) {
        if (!is_array($node)) {
            return null;
        }
        foreach ($node as $k => $v) {
            if (is_string($k) && in_array(strtolower($k), $keysLower, true) && !is_array($v) && $v !== '') {
                return $v;
            }
        }
        foreach ($node as $v) {
            if (is_array($v)) {
                $found = $scan($v);
                if ($found !== null && $found !== '') {
                    return $found;
                }
            }
        }
        return null;
    };

    foreach ($sources as $source) {
        $value = $scan($source);
        if ($value !== null && $value !== '') {
            return $value;
        }
    }

    return $default;
};

$pick = function (array $keys, $default = '') use ($sources) {
    foreach ($sources as $source) {
        $value = yeastar_pick_first($source, $keys, null);
        if ($value !== null && $value !== '') {
            return $value;
        }
    }
    return $default;
};

$eventName = (string)$pick(['event', 'event_name', 'type', 'eventType', 'event_type'], 'incoming_call');
$callId = (string)$pick(['call_id', 'unique_id', 'id', 'callid', 'callId', 'call_identifier'], uniqid('ys_', true));
$direction = (string)$pick(['direction', 'call_direction'], 'Inbound');
$fromRaw = (string)$pickDeep([
    'from_number', 'caller_number', 'caller', 'from', 'fromNumber', 'callerid', 'caller_id',
    'caller_num', 'src', 'ani', 'cid_num', 'call_from'
], '');
$toRaw = (string)$pickDeep([
    'to_number', 'callee_number', 'callee', 'to', 'toNumber', 'called_number', 'called', 'dn',
    'callee_num', 'dst', 'dnis', 'called_num', 'call_to'
], '');
$extension = (string)$pickDeep([
    'extension', 'ext', 'agent_extension', 'agentExt', 'member_extension', 'called_extension',
    'extension_number', 'agent', 'member', 'ring_to', 'ext_num', 'call_to'
], $cfg['YEASTAR_DEFAULT_EXTENSION']);

// Fallback extraction for payload variants where nested JSON cannot be decoded cleanly.
if ($fromRaw === '') {
    $fromRaw = $extractRaw('/"call_from"\s*:\s*"([^"]+)"/');
}
if ($toRaw === '') {
    $toRaw = $extractRaw('/"call_to"\s*:\s*"([^"]+)"/');
}
if ($extension === '') {
    $extension = $extractRaw('/"ext_num"\s*:\s*"([^"]+)"/');
}
if ($extension === '') {
    $extension = $extractRaw('/"extension"\s*:\s*\{\s*"number"\s*:\s*"([^"]+)"/');
}
if ($extension === '') {
    $extension = $extractRaw('/"extension"\s*:\s*"([^"]+)"/');
}

$fromNumber = yeastar_normalize_phone($fromRaw);
$toNumber = yeastar_normalize_phone($toRaw);
if ($extension === '' && preg_match('/^\d{2,6}$/', (string)$toRaw)) {
    $extension = (string)$toRaw;
}
if ($extension !== '' && !preg_match('/^[0-9A-Za-z_\-]{2,8}$/', $extension)) {
    $extension = '';
}

if ($fromNumber === '' && $toNumber === '' && $extension === '') {
    yeastar_log('webhook_missing_numbers', [
        'event' => $eventName,
        'extension' => $extension,
        'payload' => $payload,
    ]);
    // Do not fail webhook delivery for state-only events.
    yeastar_json_response(['ok' => true, 'ignored' => 'Missing call numbers'], 200);
}

$lookupPhone = $fromNumber !== '' ? $fromNumber : $toNumber;
$lookupDigits = yeastar_last_digits($lookupPhone, (int)$cfg['CUSTOMER_LOOKUP_LAST_N_DIGITS']);

$hasExternalNumber = false;
$displayNumber = '-';
foreach ([$fromNumber, $toNumber] as $candidateNumber) {
    $digits = preg_replace('/\D+/', '', (string)$candidateNumber);
    if ($digits !== '' && strlen($digits) >= 7) {
        $hasExternalNumber = true;
        $displayNumber = $candidateNumber;
        break;
    }
}
if ($displayNumber === '-') {
    $displayNumber = ($fromNumber !== '' ? $fromNumber : ($toNumber !== '' ? $toNumber : '-'));
}

$customer = null;
if ($lookupDigits !== '') {
    $sql = "
        SELECT id, name, phone, type
        FROM customers
        WHERE RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), " . strlen($lookupDigits) . ") = '" . $conn->real_escape_string($lookupDigits) . "'
        ORDER BY id DESC
        LIMIT 1
    ";

    $result = $conn->query($sql);
    if ($result && $result->num_rows > 0) {
        $customer = $result->fetch_assoc();
    }
}

$accountId = $customer['id'] ?? '';
$lead = null;
if ($accountId !== '') {
    $leadSql = "
        SELECT id, department, type, stage, status
        FROM leads
        WHERE account_id = '" . $conn->real_escape_string($accountId) . "'
          AND status = 'Pending'
        ORDER BY id DESC
        LIMIT 1
    ";
    $leadResult = $conn->query($leadSql);
    if ($leadResult && $leadResult->num_rows > 0) {
        $lead = $leadResult->fetch_assoc();
    }
}

$insurance = null;
if ($lookupDigits !== '') {
    $insSql = "
        SELECT id, insurance_name, insured_name, phone
        FROM insurance_data
        WHERE RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), " . strlen($lookupDigits) . ") = '" . $conn->real_escape_string($lookupDigits) . "'
        ORDER BY id DESC
        LIMIT 1
    ";
    $insResult = @$conn->query($insSql);
    if ($insResult && $insResult->num_rows > 0) {
        $insurance = $insResult->fetch_assoc();
    }
}

$customerType = $customer['type'] ?? '';
$popupType = $customerType !== '' ? $customerType : 'Regular';

$popupEvent = [
    'type' => 'incoming_call',
    'event' => $eventName,
    'call_id' => $callId,
    'uniqueid' => $callId,
    'direction' => $direction,
    'number' => $displayNumber,
    'from' => ($fromNumber !== '' ? $fromNumber : '-'),
    'to' => ($toNumber !== '' ? $toNumber : '-'),
    'extension' => $extension,
    'record_name' => $customer['name'] ?? '',
    'record_id' => $lead['id'] ?? '',
    'account_id' => $accountId,
    'department' => $lead['department'] ?? '',
    'lead_type' => $lead['type'] ?? '',
    'stage' => $lead['stage'] ?? '',
    'type_label' => $popupType,
    'received_at' => date('c'),
    'customer' => $customer ? [
        'id' => $customer['id'],
        'name' => $customer['name'],
        'phone' => $customer['phone'],
        'type' => $customer['type'],
    ] : null,
    'insurance' => $insurance ? [
        'id' => $insurance['id'],
        'name' => $insurance['insurance_name'],
        'insured_name' => $insurance['insured_name'],
        'phone' => $insurance['phone'],
    ] : null,
];

if ($extension !== '' && $hasExternalNumber) {
    yeastar_push_event($extension, $popupEvent);
    $popupEvent['transport'] = 'websocket';
    $wsPublished = yeastar_ws_publish($popupEvent);
} else {
    $wsPublished = false;
}

// Optional call log in existing table; ignore failure on schema mismatch.
$callDate = date('Y-m-d');
$callTime = date('H:i:s');
$numberForLog = $fromNumber !== '' ? $fromNumber : $toNumber;
if ($numberForLog !== '') {
    $insertLog = "
        INSERT INTO freeswitchintegration
        (name, direction, status, call_date, call_time, freeswitch_server, disposition, extension, number, duration_hours, duration_minutes, duration_seconds, duration, add_desscription, date_entered, date_modified, deleted)
        VALUES
        ('Yeastar Call', '" . $conn->real_escape_string($direction) . "', 'Ringing', '" . $callDate . "', '" . $callTime . "', 'Yeastar', '', '" . $conn->real_escape_string($extension) . "', '" . $conn->real_escape_string($numberForLog) . "', 0, 0, 0, 0, '', NOW(), NOW(), 0)
    ";
    @$conn->query($insertLog);
}

yeastar_log('webhook_received', [
    'event' => $eventName,
    'call_id' => $callId,
    'extension' => $extension,
    'from' => $fromNumber,
    'to' => $toNumber,
    'queued' => ($extension !== '' && $hasExternalNumber),
    'has_external_number' => $hasExternalNumber,
    'ws_published' => $wsPublished,
    'customer_id' => $customer['id'] ?? null,
]);

yeastar_json_response(['ok' => true, 'queued' => ($extension !== '' && $hasExternalNumber)]);
