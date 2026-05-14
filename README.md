# CIMA Webapp Terms

Monorepo per gestione documenti legali e pubblicazione su GitHub Pages.

## Struttura

- `frontend/`: backoffice Angular (upload, documenti, ufficiali).
- `backend/`: Admin API locale (`/api/admin/*`) con token GitHub server-side.
- `cima-legal-public-docs/`: repo pubblico (pagina, indice, cartelle `latest/` e `legacy/`).
- `docs/`: note architetturali.
- `test-docs/`: PDF di test.

## Modello dati pubblico attuale

- latest corrente:
  - `latest/[line]/[lang]/[doc-type].pdf`
- archivio:
  - `legacy/[line]/[lang]/[doc-type]_[date].pdf`
- indice usato da pagina pubblica + fallback FE:
  - `assets/latest-index.json`

## Prerequisiti

- Node LTS 22 consigliato (`.nvmrc` presente).
- GitHub token con permessi write su `CIMAFoundation/cima-legal-public-docs`.

## Avvio locale completo (FE + BE)

Terminale 1 (backend):

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

Terminale 2 (frontend):

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms/frontend
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use
npm ci
npm start
```

Health check backend:

```bash
curl -s http://127.0.0.1:8787/api/admin/health
```

## Sviluppo pagina pubblica (`cima-legal-public-docs`)

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms/cima-legal-public-docs
python3 -m http.server 4173
```

Apri:
- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/assets/latest-index.json`

Rigenera indice da cartella `latest/`:

```bash
npm run build:latest-index
```

## Build FE produzione

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms/frontend
npm run build
```

Output: `frontend/dist/frontend`

## Deploy note

- FE pensato per base path `/webterms/`.
- API pensata sotto stesso host: `/webterms/api/admin/*` (reverse proxy verso `127.0.0.1:8787`).
- `GITHUB_ADMIN_TOKEN` resta solo lato server.

## Documentazione locale

- [frontend/README.md](/Users/deda/WebstormProjects/cima-webapp-terms/frontend/README.md)
- [backend/README.md](/Users/deda/WebstormProjects/cima-webapp-terms/backend/README.md)
- [cima-legal-public-docs/README.md](/Users/deda/WebstormProjects/cima-webapp-terms/cima-legal-public-docs/README.md)
