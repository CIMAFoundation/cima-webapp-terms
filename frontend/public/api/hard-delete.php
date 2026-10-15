<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_session.php';
require_document_manager();
out(410, ['error' => 'Eliminazione definitiva disabilitata. Usa il ritiro dalla pubblicazione.']);
