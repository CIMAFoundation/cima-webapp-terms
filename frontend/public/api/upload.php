<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$body = json_input();
$line = trim((string) ($body['line'] ?? ''));
$lang = trim((string) ($body['lang'] ?? ''));
$docType = normalize_upload_doc_type((string) ($body['docType'] ?? ''));
$date = trim((string) ($body['date'] ?? ''));
$fileName = trim((string) ($body['fileName'] ?? ''));
$contentBase64 = trim((string) ($body['contentBase64'] ?? ''));

if ($line === '' || $lang === '' || $docType === '' || $date === '' || $fileName === '' || $contentBase64 === '') {
    out(400, ['error' => 'Missing upload fields']);
}

$latestPath = 'latest/' . $line . '/' . $lang . '/' . $docType . '.pdf';
$legacyPath = 'legacy/' . $line . '/' . $lang . '/' . $docType . '_' . $date . '.pdf';

upsert_file($latestPath, $contentBase64, 'docs: latest ' . $line . '/' . $lang . '/' . $docType);
upsert_file($legacyPath, $contentBase64, 'docs: legacy ' . $line . '/' . $lang . '/' . $docType . '_' . $date);

$index = fetch_latest_index();
$rows = is_array($index['rows'] ?? null) ? $index['rows'] : [];
$rows = array_values(array_filter($rows, static function (array $row) use ($line, $lang, $docType): bool {
    return !((string) ($row['line'] ?? '') === $line
        && (string) ($row['lang'] ?? '') === $lang
        && (string) ($row['docType'] ?? '') === $docType);
}));

$cfg = env_config();
$rows[] = [
    'id' => $line . '-' . $lang . '-' . $docType,
    'line' => $line,
    'lang' => $lang,
    'docType' => $docType,
    'effectiveDate' => $date,
    'publicUrl' => rtrim((string) $cfg['PUBLIC_BASE_URL'], '/') . '/' . $latestPath,
    'downloadFileName' => $docType . '.pdf'
];

save_latest_index($rows, 'docs: update latest-index ' . $line . '/' . $lang . '/' . $docType);

out(200, ['latestPath' => $latestPath, 'legacyPath' => $legacyPath]);
