<?php
session_start();
ob_start();

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../../includes/db_handler/connect.php';

function yeastar_log_request($line)
{
    $dir = __DIR__ . '/../../YeastarIntegration/runtime';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    @file_put_contents($dir . '/search_contact.log', '[' . date('Y-m-d H:i:s') . '] ' . $line . PHP_EOL, FILE_APPEND);
}

function normalize_phone_digits($phone)
{
    return preg_replace('/\D+/', '', (string)$phone);
}

function json_response($data, $status = 200)
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

$phone = '';
$candidates = [
    $_GET['phone'] ?? '',
    $_GET['number'] ?? '',
    $_GET['mobile'] ?? '',
    $_GET['keyword'] ?? '',
    $_POST['phone'] ?? '',
    $_POST['number'] ?? '',
    $_POST['mobile'] ?? '',
    $_POST['keyword'] ?? '',
];
foreach ($candidates as $candidate) {
    $candidate = trim((string)$candidate);
    if ($candidate !== '') {
        $phone = $candidate;
        break;
    }
}

$rawBody = file_get_contents('php://input');
$authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? (string)$_SERVER['HTTP_AUTHORIZATION'] : '';
yeastar_log_request(
    'method=' . ($_SERVER['REQUEST_METHOD'] ?? '') .
    ' query=' . json_encode($_GET) .
    ' post=' . json_encode($_POST) .
    ' phone=' . $phone .
    ' auth=' . ($authHeader !== '' ? 'present' : 'missing') .
    ' ua=' . ($_SERVER['HTTP_USER_AGENT'] ?? '')
);

$digits = normalize_phone_digits($phone);

$conn = carguruDB();
$rows = [];

if ($digits === '') {
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 200;
    if ($limit <= 0 || $limit > 1000) {
        $limit = 200;
    }
    $sql = "
        SELECT id, name, phone
        FROM customers
        WHERE phone IS NOT NULL AND phone <> ''
        ORDER BY id DESC
        LIMIT " . $limit;
    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'id' => (string)$row['id'],
                'name' => (string)$row['name'],
                'phone' => (string)$row['phone']
            ];
        }
    }
} else {
    $lookupDigits = strlen($digits) > 9 ? substr($digits, -9) : $digits;
    $sql = "
        SELECT id, name, phone
        FROM customers
        WHERE RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), ?) = ?
        ORDER BY id DESC
        LIMIT 10
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        json_response([
            'success' => false,
            'message' => 'DB prepare failed',
            'data' => []
        ], 500);
    }
    $length = strlen($lookupDigits);
    $stmt->bind_param('is', $length, $lookupDigits);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'id' => (string)$row['id'],
                'name' => (string)$row['name'],
                'phone' => (string)$row['phone']
            ];
        }
    }
    $stmt->close();
}
$conn->close();

json_response([
    'success' => true,
    'message' => 'Customers',
    'data' => $rows,
    'total' => count($rows)
]);
