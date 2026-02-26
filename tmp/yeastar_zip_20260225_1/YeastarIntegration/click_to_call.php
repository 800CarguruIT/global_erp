<?php
session_start();
ob_start();

require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    yeastar_json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$extension = isset($_POST['extension']) ? (string)$_POST['extension'] : '';
if ($extension === '' && isset($_SESSION['extension'])) {
    $extension = (string)$_SESSION['extension'];
}
$extension = yeastar_normalize_extension($extension);

$number = isset($_POST['number']) ? (string)$_POST['number'] : '';
$number = yeastar_normalize_phone($number);

if ($extension === '' || $extension === '0') {
    yeastar_json_response(['ok' => false, 'error' => 'Missing extension'], 400);
}
if ($number === '') {
    yeastar_json_response(['ok' => false, 'error' => 'Missing number'], 400);
}

$dial = yeastar_openapi_dial($extension, $number);
if (empty($dial['ok'])) {
    yeastar_json_response([
        'ok' => false,
        'error' => $dial['error'] ?? 'Dial failed',
        'details' => $dial['raw'] ?? ($dial['token_raw'] ?? null),
    ], 500);
}

yeastar_json_response([
    'ok' => true,
    'message' => 'Dial started',
    'details' => $dial['response'] ?? null,
]);
