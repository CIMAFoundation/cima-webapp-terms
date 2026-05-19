# CIMA Webapp Terms

Monorepo per gestione documenti legali e pubblicazione su GitHub Pages.

## Struttura

- `frontend/`: backoffice Angular (upload, documenti, ufficiali).
- `frontend/public/api/`: Admin API PHP (`/webterms/api/*.php`) con token GitHub server-side.
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

## Avvio locale completo (FE + BE PHP)

Terminale 1 (API PHP):

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms
cp frontend/public/webterms.env.php.example frontend/public/webterms.env.php
# compila frontend/public/webterms.env.php con token e parametri reali
php -S 127.0.0.1:8787 -t frontend/public
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
curl -s http://127.0.0.1:8787/api/health.php
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
- API pensata sotto stesso host: `/webterms/api/*.php`.
- `GITHUB_ADMIN_TOKEN` resta solo lato server, dentro `webterms.env.php` (non versionato).

## Documentazione locale

- [frontend/README.md](/Users/deda/WebstormProjects/cima-webapp-terms/frontend/README.md)
- [backend/README.md](/Users/deda/WebstormProjects/cima-webapp-terms/backend/README.md) (legacy Node, opzionale)
- [cima-legal-public-docs/README.md](/Users/deda/WebstormProjects/cima-webapp-terms/cima-legal-public-docs/README.md)
