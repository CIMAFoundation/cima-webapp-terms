<?php
declare(strict_types=1);
require_once __DIR__ . '/_session.php';

/** Validates all selected documents before asking CI to change their publication state. */
function dispatch_document_state(array $items, string $action): void
{
    require_document_manager();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'Method not allowed']);
    if ($items === [] || count($items) > 100) out(400, ['error' => 'Seleziona da 1 a 100 documenti']);
    $rows = fetch_latest_index()['rows'] ?? [];
    $ids = [];
    foreach ($items as $item) {
        if (!is_array($item)) out(400, ['error' => 'Documento non valido']);
        $idx = find_row_index($rows, resolve_row_criteria($item));
        if ($idx < 0) out(404, ['error' => 'Documento non trovato']);
        $ids[] = (string) $rows[$idx]['id'];
    }
    $res = github_repo_request('POST', '/actions/workflows/publish-pages.yml/dispatches', [
        'ref' => env_config()['GITHUB_BRANCH'],
        'inputs' => ['action' => $action, 'ids' => json_encode(array_values(array_unique($ids)))]]);
    if ($res['status'] !== 204) out(502, ['error' => 'Avvio CI fallito; verifica workflow e permesso Actions del token.']);
    out(202, ['ok' => true, 'status' => 'queued']);
}
