<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_session.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'Method not allowed']);
webterms_session();
$token = $_SERVER['HTTP_X_WEBTERMS_CSRF'] ?? '';
if ($token === '' || !hash_equals($_SESSION['csrf'] ?? '', $token)) out(403, ['error' => 'Sessione non valida']);
$_SESSION = [];
session_destroy();
out(200, ['ok' => true]);
