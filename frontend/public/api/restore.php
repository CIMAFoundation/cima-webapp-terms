<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$body = json_input();
$index = fetch_latest_index();
$rows = is_array($index['rows'] ?? null) ? $index['rows'] : [];
$criteria = resolve_row_criteria($body);
$idx = find_row_index($rows, $criteria);
if ($idx < 0) {
    out(404, ['error' => 'Document not found']);
}

unset($rows[$idx]['deletedAt']);
save_latest_index($rows, 'docs: restore ' . $criteria['line'] . '/' . $criteria['lang'] . '/' . ($rows[$idx]['docType'] ?? ''));
out(200, ['ok' => true]);
