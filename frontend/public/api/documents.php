<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_session.php';
require_document_manager();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') out(405, ['error' => 'Method not allowed']);
header('Cache-Control: no-store');
out(200, fetch_latest_index());
