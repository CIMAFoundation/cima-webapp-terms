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

delete_file($filePath, 'docs: hard-delete ' . $criteria['line'] . '/' . $criteria['lang'] . '/' . (string) ($criteria['docType'] ?? ''));
array_splice($rows, $idx, 1);
save_latest_index($rows, 'docs: latest-index remove ' . ($row['line'] ?? '') . '/' . ($row['lang'] ?? '') . '/' . ($row['docType'] ?? ''));

out(200, ['ok' => true]);
