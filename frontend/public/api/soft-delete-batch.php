<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$body = json_input();
$items = is_array($body['items'] ?? null) ? $body['items'] : [];
if ($items === []) {
    out(200, ['ok' => true]);
}

$index = fetch_latest_index();
$rows = is_array($index['rows'] ?? null) ? $index['rows'] : [];
$changed = 0;
foreach ($items as $item) {
    if (!is_array($item)) {
        continue;
    }
    $criteria = resolve_row_criteria($item);
    $idx = find_row_index($rows, $criteria);
    if ($idx < 0) {
        continue;
    }
    $rows[$idx]['deletedAt'] = gmdate('c');
    $changed++;
}

if ($changed > 0) {
    save_latest_index($rows, 'docs: soft-delete batch (' . $changed . ')');
}

out(200, ['ok' => true]);
