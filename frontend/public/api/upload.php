<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_session.php';
require_document_manager();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'Method not allowed']);

$body = json_input();
$items = $body['items'] ?? [$body];
if (!is_array($items) || $items === [] || array_keys($items) !== range(0, count($items) - 1)) {
    out(400, ['error' => 'Missing upload items']);
}

$cfg = env_config();
$updates = [];
$uploaded = [];

// Validate the whole batch before reading the index or writing any GitHub object.
foreach ($items as $item) {
    if (!is_array($item)) {
        out(400, ['error' => 'Invalid upload item']);
    }
    $line = trim((string) ($item['line'] ?? ''));
    $lang = trim((string) ($item['lang'] ?? ''));
    $docType = normalize_upload_doc_type((string) ($item['docType'] ?? ''));
    $date = trim((string) ($item['date'] ?? ''));
    $fileName = trim((string) ($item['fileName'] ?? ''));
    $contentBase64 = trim((string) ($item['contentBase64'] ?? ''));

    if (!preg_match('/^[a-z0-9-]+$/', $line)
        || !in_array($lang, ['it', 'en', 'fr', 'es', 'pt'], true)
        || !in_array($docType, ['terms-of-use', 'privacy-policy', 'cookie-policy'], true)
        || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
        || $fileName === ''
        || $contentBase64 === ''
        || base64_decode($contentBase64, true) === false) {
        out(400, ['error' => 'Invalid upload fields']);
    }

    $latestPath = 'latest/' . $line . '/' . $lang . '/' . $docType . '.pdf';
    $legacyPath = 'legacy/' . $line . '/' . $lang . '/' . $docType . '_' . $date . '.pdf';
    if (isset($updates[$latestPath])) {
        out(400, ['error' => 'Duplicate destination in upload batch: ' . $latestPath]);
    }

    $updates[$latestPath] = $contentBase64;
    $updates[$legacyPath] = $contentBase64;
    $uploaded[] = [
        'id' => $line . '-' . $lang . '-' . $docType,
        'line' => $line,
        'lang' => $lang,
        'docType' => $docType,
        'effectiveDate' => $date,
        'originalFileName' => $fileName,
        'sha256' => hash('sha256', base64_decode($contentBase64, true)),
        'publicUrl' => rtrim((string) $cfg['PUBLIC_BASE_URL'], '/') . '/' . $latestPath,
        'downloadFileName' => $docType . '.pdf',
        'latestPath' => $latestPath,
        'legacyPath' => $legacyPath
    ];
}

$index = fetch_latest_index();
$rows = is_array($index['rows'] ?? null) ? $index['rows'] : [];
foreach ($uploaded as $upload) {
    $rows = array_values(array_filter($rows, static function (array $row) use ($upload): bool {
        return !((string) ($row['line'] ?? '') === $upload['line']
            && (string) ($row['lang'] ?? '') === $upload['lang']
            && (string) ($row['docType'] ?? '') === $upload['docType']);
    }));
    $rows[] = array_diff_key($upload, array_flip(['latestPath', 'legacyPath']));
}

$updates[(string) $cfg['LATEST_INDEX_PATH']] = encoded_latest_index($rows);
commit_files_atomic($updates, 'docs: upload ' . count($uploaded) . ' documents + latest-index');

if (count($uploaded) === 1 && !isset($body['items'])) {
    out(200, array_merge($uploaded[0], ['count' => 1, 'documents' => $uploaded]));
}
out(200, ['count' => count($uploaded), 'documents' => $uploaded]);
