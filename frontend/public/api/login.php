<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_session.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'Method not allowed']);
$body = json_input();
$username = (string) ($body['username'] ?? '');
$password = (string) ($body['password'] ?? '');
if ($username === '' || $password === '') out(400, ['error' => 'Credenziali mancanti']);
// Validate credentials with the existing identity service; never trust a client-supplied role.
$ch = curl_init((string) env_config()['INFRA_AUTH_URL']);
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_TIMEOUT => 20,
    CURLOPT_POSTFIELDS => json_encode(['username' => $username, 'password' => $password])]);
$raw = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$user = is_string($raw) ? json_decode($raw, true) : null;
if ($raw === false || $status !== 200 || !is_array($user)
    || !isset($user['success']) || !is_bool($user['success'])) {
    out(503, ['error' => 'Servizio di autenticazione non disponibile. Riprova più tardi.']);
}
if ($user['success'] !== true) {
    out(401, ['error' => 'Username o password non corretti.']);
}
if (!isset($user['username'], $user['role']) || !is_string($user['username'])
    || !is_string($user['role'])) {
    out(503, ['error' => 'Risposta del servizio di autenticazione non valida.']);
}
webterms_session();
session_regenerate_id(true);
$_SESSION = ['role' => strtolower(trim((string) ($user['role'] ?? ''))),
    'expires' => time() + 3600, 'csrf' => bin2hex(random_bytes(32))];
$token = $_SESSION['csrf'];
session_write_close();
out(200, ['token' => $token, 'user' => ['id' => $user['id'] ?? null,
    'username' => $user['username'], 'role' => $user['role'] ?? ''], 'source' => 'infrastruttura-api']);
