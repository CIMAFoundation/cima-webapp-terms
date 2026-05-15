<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET,POST,OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    http_response_code(204);
    exit;
}

function env_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }

    $defaults = [
        'GITHUB_OWNER' => 'CIMAFoundation',
        'GITHUB_REPO' => 'cima-legal-public-docs',
        'GITHUB_BRANCH' => 'main',
        'LATEST_INDEX_PATH' => 'assets/latest-index.json',
        'PUBLIC_BASE_URL' => 'https://cimafoundation.github.io/cima-legal-public-docs',
        'GITHUB_ADMIN_TOKEN' => ''
    ];

    $envPath = dirname(__DIR__) . '/webterms.env.php';
    $loaded = [];
    if (is_file($envPath)) {
        $loaded = require $envPath;
        if (!is_array($loaded)) {
            $loaded = [];
        }
    }

    $cfg = array_merge($defaults, $loaded);
    return $cfg;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function out(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ensure_token(): string
{
    $cfg = env_config();
    $token = trim((string) ($cfg['GITHUB_ADMIN_TOKEN'] ?? ''));
    if ($token === '') {
        out(500, ['error' => 'GITHUB_ADMIN_TOKEN missing on server']);
    }
    return $token;
}

function github_headers(string $token): array
{
    return [
        'Authorization: Bearer ' . $token,
        'Accept: application/vnd.github+json',
        'Content-Type: application/json',
        'User-Agent: webterms-admin-api'
    ];
}

function github_request(string $method, string $path, ?array $body = null): array
{
    $cfg = env_config();
    $token = ensure_token();

    $url = 'https://api.github.com/repos/' . rawurlencode((string) $cfg['GITHUB_OWNER'])
        . '/' . rawurlencode((string) $cfg['GITHUB_REPO'])
        . '/contents/' . ltrim($path, '/');

    if ($method === 'GET') {
        $sep = strpos($url, '?') !== false ? '&' : '?';
        $url .= $sep . 'ref=' . rawurlencode((string) $cfg['GITHUB_BRANCH']);
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, github_headers($token));
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES));
    }

    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        out(500, ['error' => 'GitHub request failed: ' . $err]);
    }

    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode((string) $raw, true);
    return [
        'status' => $status,
        'json' => is_array($json) ? $json : null,
        'raw' => (string) $raw
    ];
}

function parse_latest_file_path(string $filePath): ?array
{
    $normalized = ltrim(trim($filePath), '/');
    if (!preg_match('#^latest/([^/]+)/([^/]+)/([^/]+)\\.pdf$#i', $normalized, $m)) {
        return null;
    }
    return ['line' => $m[1], 'lang' => $m[2], 'docType' => $m[3]];
}

function normalize_upload_doc_type(string $value): string
{
    $raw = trim($value);
    if ($raw === 'terms' || $raw === 'terms-of-use') {
        return 'terms-of-use';
    }
    if ($raw === 'privacy' || $raw === 'privacy-policy') {
        return 'privacy-policy';
    }
    if ($raw === 'cookie' || $raw === 'cookie-policy') {
        return 'cookie-policy';
    }
    return $raw;
}

function normalize_canonical_doc_type(string $value): string
{
    $raw = trim($value);
    if ($raw === 'terms' || $raw === 'terms-of-use') {
        return 'terms';
    }
    if ($raw === 'privacy' || $raw === 'privacy-policy') {
        return 'privacy';
    }
    if ($raw === 'cookie' || $raw === 'cookie-policy') {
        return 'cookie';
    }
    return $raw;
}

function canonical_row_doc_type(array $row): string
{
    return normalize_canonical_doc_type((string) ($row['docType'] ?? ''));
}

function find_row_index(array $rows, array $criteria): int
{
    $line = (string) ($criteria['line'] ?? '');
    $lang = (string) ($criteria['lang'] ?? '');
    $docType = normalize_canonical_doc_type((string) ($criteria['docType'] ?? ''));

    foreach ($rows as $i => $row) {
        if ((string) ($row['line'] ?? '') === $line
            && (string) ($row['lang'] ?? '') === $lang
            && canonical_row_doc_type($row) === $docType) {
            return (int) $i;
        }
    }
    return -1;
}

function resolve_row_criteria(array $body): array
{
    $filePath = trim((string) ($body['filePath'] ?? ''));
    $parsed = $filePath !== '' ? parse_latest_file_path($filePath) : null;
    if ($parsed !== null) {
        return $parsed;
    }
    return [
        'line' => trim((string) ($body['platform'] ?? '')),
        'lang' => trim((string) ($body['lang'] ?? '')),
        'docType' => trim((string) ($body['docType'] ?? ''))
    ];
}

function fetch_latest_index(): array
{
    $cfg = env_config();
    $res = github_request('GET', (string) $cfg['LATEST_INDEX_PATH']);
    if ($res['status'] === 404) {
        return ['generatedAt' => gmdate('c'), 'rows' => []];
    }
    if ($res['status'] < 200 || $res['status'] >= 300 || !is_array($res['json'])) {
        out(500, ['error' => 'Latest index read failed (' . $res['status'] . '): ' . $res['raw']]);
    }

    $encoded = str_replace("\n", '', (string) ($res['json']['content'] ?? ''));
    $decoded = base64_decode($encoded, true);
    $parsed = is_string($decoded) ? json_decode($decoded, true) : null;

    return [
        'generatedAt' => (string) (($parsed['generatedAt'] ?? null) ?: gmdate('c')),
        'rows' => is_array($parsed['rows'] ?? null) ? $parsed['rows'] : []
    ];
}

function get_existing_sha(string $path): ?string
{
    $res = github_request('GET', $path);
    if ($res['status'] === 404) {
        return null;
    }
    if ($res['status'] < 200 || $res['status'] >= 300 || !is_array($res['json'])) {
        out(500, ['error' => 'File read failed (' . $res['status'] . '): ' . $res['raw']]);
    }
    return (string) ($res['json']['sha'] ?? '');
}

function upsert_file(string $path, string $contentBase64, string $message): void
{
    $cfg = env_config();
    $sha = get_existing_sha($path);
    $payload = [
        'message' => $message,
        'content' => $contentBase64,
        'branch' => (string) $cfg['GITHUB_BRANCH']
    ];
    if ($sha !== null && $sha !== '') {
        $payload['sha'] = $sha;
    }

    $res = github_request('PUT', $path, $payload);
    if ($res['status'] < 200 || $res['status'] >= 300) {
        out(500, ['error' => 'File upsert failed (' . $res['status'] . '): ' . $res['raw']]);
    }
}

function delete_file(string $path, string $message): void
{
    $cfg = env_config();
    $sha = get_existing_sha($path);
    if ($sha === null || $sha === '') {
        return;
    }

    $res = github_request('DELETE', $path, [
        'message' => $message,
        'branch' => (string) $cfg['GITHUB_BRANCH'],
        'sha' => $sha
    ]);
    if (!in_array($res['status'], [200, 404], true)) {
        out(500, ['error' => 'File delete failed (' . $res['status'] . '): ' . $res['raw']]);
    }
}

function save_latest_index(array $rows, string $message): void
{
    $cfg = env_config();
    usort($rows, static function (array $a, array $b): int {
        $lineCmp = strcmp((string) ($a['line'] ?? ''), (string) ($b['line'] ?? ''));
        if ($lineCmp !== 0) {
            return $lineCmp;
        }
        $langCmp = strcmp((string) ($a['lang'] ?? ''), (string) ($b['lang'] ?? ''));
        if ($langCmp !== 0) {
            return $langCmp;
        }
        return strcmp((string) ($a['docType'] ?? ''), (string) ($b['docType'] ?? ''));
    });

    $payload = [
        'generatedAt' => gmdate('c'),
        'rows' => array_values($rows)
    ];
    $encoded = base64_encode(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    upsert_file((string) $cfg['LATEST_INDEX_PATH'], $encoded, $message);
}
