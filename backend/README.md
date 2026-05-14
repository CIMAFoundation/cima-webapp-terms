# Admin API Backend

Server Node locale per operazioni admin GitHub con token server-side.

## Endpoint

- `GET /api/admin/health`
- `POST /api/admin/documents/soft-delete`
- `POST /api/admin/documents/soft-delete-batch`
- `POST /api/admin/documents/restore`
- `POST /api/admin/documents/hard-delete`

## Requisiti

- Node LTS 22.
- Token GitHub con write su repo pubblico.

## Avvio locale

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use

export ADMIN_API_PORT=8787
export GITHUB_OWNER=CIMAFoundation
export GITHUB_REPO=cima-legal-public-docs
export GITHUB_BRANCH=main
export MANIFEST_PATH=legal-docs/manifests/latest.json
export GITHUB_ADMIN_TOKEN='PASTE_NEW_TOKEN'

node backend/admin-server.mjs
```

Health:

```bash
curl -s http://127.0.0.1:8787/api/admin/health
```

Atteso: `tokenConfigured: true`

## Nota indice pubblico

Hard delete ora aggiorna anche `assets/latest-index.json` quando file rimosso da `latest/...`.

## Sicurezza

- Non mettere token in frontend/localStorage.
- Ruota token se finito in log/chat.
