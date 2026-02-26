<?php

require_once __DIR__ . '/helpers.php';

yeastar_ensure_runtime_dirs();

$extension = isset($_GET['extension']) ? trim($_GET['extension']) : '';
if ($extension === '') {
    yeastar_json_response(['ok' => false, 'error' => 'Missing extension'], 400);
}

@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', 'off');
@ini_set('implicit_flush', '1');
while (ob_get_level() > 0) {
    @ob_end_flush();
}

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

$start = time();
$maxSeconds = 90; // long-poll SSE window

while ((time() - $start) < $maxSeconds) {
    $events = yeastar_pop_events($extension);
    if (!empty($events)) {
        foreach ($events as $event) {
            echo "event: incoming_call\n";
            echo 'data: ' . json_encode($event) . "\n\n";
        }
        @flush();
        exit;
    }

    echo ": heartbeat\n\n";
    @flush();
    usleep(1500000);
}

echo "event: keepalive\n";
echo "data: {}\n\n";
@flush();
