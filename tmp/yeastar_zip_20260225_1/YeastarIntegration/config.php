<?php

return [
    // Token expected in: Authorization: Bearer <token>
    'YEASTAR_WEBHOOK_TOKEN' => 'TEST_TOKEN1234567890',

    // For Yeastar API Webhook Event Push (Integrations > API):
    // copy PBX Webhook "Secret" value here to verify X-Signature.
    'YEASTAR_WEBHOOK_SECRET' => '28rkjah2uJOMXoMqK6wfDpJo4yQgWPDe',

    // Optional fallback extension if payload does not include one.
    'YEASTAR_DEFAULT_EXTENSION' => '',

    // Runtime paths
    'SSE_DIR' => __DIR__ . '/runtime/sse',
    'LOG_FILE' => __DIR__ . '/runtime/yeastar.log',

    // Query behavior
    'CUSTOMER_LOOKUP_LAST_N_DIGITS' => 9,

    // WebSocket bridge settings (optional, recommended for high-volume popup reliability)
    'YEASTAR_WS_PUSH_ENABLED' => false,
    'YEASTAR_WS_PUSH_URL' => 'http://127.0.0.1:5190/push',
    'YEASTAR_WS_PUSH_TOKEN' => 'CG-800-2026',

    // Yeastar OpenAPI (for click-to-call from CRM)
    // Example base URL: https://your-pbx.domain.com
    // API path is usually openapi/v1.0
    'YEASTAR_API_BASE_URL' => 'https://192.168.50.253:8088',
    'YEASTAR_API_PATH' => 'openapi/v1.0',
    'YEASTAR_API_CLIENT_ID' => 'tweY9eknq7K2K4smrgJOY0MNAUOXUIpw',
    'YEASTAR_API_CLIENT_SECRET' => 'x1w8vSOPLrYF4rGsxiX8uyg66VTo1i3U',
    // Some Yeastar OpenAPI setups require username/password for get_token.
    'YEASTAR_API_USERNAME' => 'tweY9eknq7K2K4smrgJOY0MNAUOXUIpw',
    'YEASTAR_API_PASSWORD' => 'x1w8vSOPLrYF4rGsxiX8uyg66VTo1i3U',
    'YEASTAR_API_USER_AGENT' => 'OpenAPI',
    // Set to false only for trusted local/self-signed PBX certificates.
    'YEASTAR_API_SSL_VERIFY' => false,
    // call/dial behavior for extension caller: yes|no
    'YEASTAR_API_AUTO_ANSWER' => 'yes',
    // Optional: use another extension's outbound permission when needed.
    'YEASTAR_API_DIAL_PERMISSION' => '',
    'YEASTAR_API_TOKEN_CACHE_FILE' => __DIR__ . '/runtime/token-cache.json',
];
