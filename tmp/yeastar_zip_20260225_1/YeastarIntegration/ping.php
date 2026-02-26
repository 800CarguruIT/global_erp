<?php
header('Content-Type: application/json');

$dir = __DIR__ . '/runtime';
if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
}

$raw = file_get_contents('php://input');
if ($raw === false) {
    $raw = '';
}

$line = '[' . date('Y-m-d H:i:s') . '] '
    . 'method=' . ($_SERVER['REQUEST_METHOD'] ?? '')
    . ' ua=' . ($_SERVER['HTTP_USER_AGENT'] ?? '')
    . ' body=' . $raw
    . PHP_EOL;

@file_put_contents($dir . '/ping.log', $line, FILE_APPEND);

echo json_encode(['ok' => true, 'message' => 'pong']);

