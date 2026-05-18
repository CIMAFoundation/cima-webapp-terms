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

$row = $rows[$idx];
$filePath = trim((string) ($body['filePath'] ?? ''));
if ($filePath === '') {
    $filePath = 'latest/' . ($row['line'] ?? '') . '/' . ($row['lang'] ?? '') . '/' . ($row['docType'] ?? '') . '.pdf';
}

array_splice($rows, $idx, 1);
commit_delete_and_updates_atomic(
    [$filePath],
    [((string) env_config()['LATEST_INDEX_PATH']) => encoded_latest_index($rows)],
    'docs: hard-delete ' . ($row['line'] ?? '') . '/' . ($row['lang'] ?? '') . '/' . ($row['docType'] ?? '') . ' + latest-index'
);

out(200, ['ok' => true]);
