<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_withdrawal.php';
$body = json_input();
dispatch_document_state($body['items'] ?? [$body], 'restore');
