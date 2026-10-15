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
$ch = curl_init('https://mockup.cimafoundation.org/infrastruttura/api/auth.php');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_TIMEOUT => 20,
    CURLOPT_POSTFIELDS => json_encode(['username' => $username, 'password' => $password])]);
$raw = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$user = is_string($raw) ? json_decode($raw, true) : null;
if ($status !== 200 || !is_array($user) || ($user['success'] ?? false) !== true) {
    out(401, ['error' => 'Autenticazione fallita']);
}
webterms_session();
session_regenerate_id(true);
$_SESSION = ['role' => strtolower(trim((string) ($user['role'] ?? ''))),
    'expires' => time() + 3600, 'csrf' => bin2hex(random_bytes(32))];
$token = $_SESSION['csrf'];
session_write_close();
out(200, ['token' => $token, 'user' => ['id' => $user['id'] ?? null,
    'username' => $user['username'], 'role' => $user['role'] ?? ''], 'source' => 'infrastruttura-api']);
