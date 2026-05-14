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
export GITHUB_ADMIN_TOKEN='PASTE_NEW_TOKEN'

node backend/admin-server.mjs
```

Health:

```bash
curl -s http://127.0.0.1:8787/api/admin/health
```

Atteso: `tokenConfigured: true`

## Nota indice pubblico

Admin API lavora in modalita `manifest-zero`:
- upload aggiorna `latest/`, `legacy/`, `assets/latest-index.json`
- soft-delete/restore aggiornano `deletedAt` in `assets/latest-index.json`
- hard-delete rimuove file `latest/...` + riga da `assets/latest-index.json`

## Sicurezza

- Non mettere token in frontend/localStorage.
- Ruota token se finito in log/chat.
