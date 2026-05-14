<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$cfg = env_config();
out(200, [
    'ok' => true,
    'repo' => $cfg['GITHUB_OWNER'] . '/' . $cfg['GITHUB_REPO'],
    'branch' => $cfg['GITHUB_BRANCH'],
    'indexPath' => $cfg['LATEST_INDEX_PATH'],
    'tokenConfigured' => trim((string) ($cfg['GITHUB_ADMIN_TOKEN'] ?? '')) !== ''
]);
