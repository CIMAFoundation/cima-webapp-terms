<?php
declare(strict_types=1);
require __DIR__ . '/../../frontend/public/api/_session.php';

/** Captures endpoint responses without terminating the test runner. */
function out(int $status, array $payload): void { throw new RuntimeException((string) $status); }
/** Supplies the existing document fixture without contacting GitHub. */
function fetch_latest_index(): array { return ['rows' => [['id' => 'demo-it-terms-of-use']]]; }
/** Supplies the branch configured by the server. */
function env_config(): array { return ['GITHUB_BRANCH' => 'main']; }
/** Resolves fixture criteria for dispatch tests. */
function resolve_row_criteria(array $item): array { return $item; }
/** Returns no match for the explicit missing-document case. */
function find_row_index(array $rows, array $item): int { return isset($item['missing']) ? -1 : 0; }
/** Verifies that only the expected workflow and server-selected IDs are dispatched. */
function github_repo_request(string $method, string $path, array $body): array
{
    if ($method !== 'POST' || $path !== '/actions/workflows/publish-pages.yml/dispatches'
        || $body['inputs']['ids'] !== '["demo-it-terms-of-use"]') throw new LogicException('Invalid dispatch');
    return ['status' => 204];
}
require __DIR__ . '/../../frontend/public/api/_withdrawal.php';
$case = $argv[1];
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['HTTP_X_WEBTERMS_CSRF'] = 'test-csrf';
webterms_session();
$_SESSION = ['role' => $case === 'dev' ? 'dev' : 'admin', 'expires' => time() + 60, 'csrf' => 'test-csrf'];
$expected = 202;
if ($case === 'anonymous') { $_SESSION = []; $expected = 401; }
if ($case === 'expired') { $_SESSION['expires'] = 1; $expected = 401; }
if ($case === 'viewer') { $_SESSION['role'] = 'viewer'; $expected = 403; }
if ($case === 'forged-csrf') { $_SERVER['HTTP_X_WEBTERMS_CSRF'] = 'forged'; $expected = 403; }
if ($case === 'get') { $_SERVER['REQUEST_METHOD'] = 'GET'; $expected = 405; }
if ($case === 'missing') $expected = 404;
session_write_close();
try {
    dispatch_document_state([$case === 'missing' ? ['missing' => true] : []], 'withdraw');
    throw new LogicException('Missing response');
} catch (RuntimeException $error) {
    if ((int) $error->getMessage() !== $expected) throw $error;
    echo $case . ': ' . $expected . " OK\n";
}
