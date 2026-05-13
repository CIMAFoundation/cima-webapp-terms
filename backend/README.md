# Admin API (server-side GitHub token)

Questo servizio espone endpoint locali usati dal frontend per:
- soft delete documenti
- restore documenti
- hard delete documenti

Il token GitHub resta sul server (env), non nel browser.

## Avvio

```bash
cd /Users/deda/.codex/worktrees/ed10/cima-webapp-terms
export GITHUB_ADMIN_TOKEN="ghp_xxx"
export GITHUB_OWNER="CIMAFoundation"
export GITHUB_REPO="cima-legal-public-docs"
export GITHUB_BRANCH="main"
export MANIFEST_PATH="legal-docs/manifests/latest.json"
node backend/admin-server.mjs
```

Health:

```bash
curl http://127.0.0.1:8787/api/admin/health
```

Con frontend `npm start`, proxy Angular inoltra `/api/admin/*` a `127.0.0.1:8787`.
