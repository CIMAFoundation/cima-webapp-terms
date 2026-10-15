<?php
declare(strict_types=1);

/** Starts a same-origin, HTTP-only session for authenticated Webterms users. */
function webterms_session(): void
{
    session_name('webterms_session');
    session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Strict', 'path' => '/']);
    session_start();
}

/** Rejects expired sessions and requests from roles other than admin or dev. */
function require_document_manager(): void
{
    webterms_session();
    if (($_SESSION['expires'] ?? 0) < time()) {
        out(401, ['error' => 'Sessione scaduta: accedi nuovamente.']);
    }
    if (!in_array($_SESSION['role'] ?? '', ['admin', 'dev'], true)) {
        out(403, ['error' => 'Operazione riservata ad admin e dev.']);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        $token = $_SERVER['HTTP_X_WEBTERMS_CSRF'] ?? '';
        if (!hash_equals($_SESSION['csrf'] ?? '', $token) || $token === '') {
            out(403, ['error' => 'Sessione non valida: accedi nuovamente.']);
        }
    }
    session_write_close();
}
