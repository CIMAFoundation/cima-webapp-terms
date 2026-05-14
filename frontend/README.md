# Frontend WebTerms

Backoffice Angular per upload, gestione documenti, vista ufficiale.

## Requisiti

- Node LTS 22 (`.nvmrc` root repo).
- API PHP avviata su `127.0.0.1:8787` per upload/delete/restore/hard-delete.

## Avvio locale

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms/frontend
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use
npm ci
npm start
```

URL: `http://localhost:4200`

`npm start` usa proxy `proxy.conf.json`:
- `/api/*` -> `http://127.0.0.1:8787/api/*`

Avvio API locale:

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms
cp frontend/public/webterms.env.php.example frontend/public/webterms.env.php
# compila frontend/public/webterms.env.php
php -S 127.0.0.1:8787 -t frontend/public
```

## Build

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms/frontend
npm run build
```

Output: `dist/frontend` (base href/deploy url `/webterms/`).

## Flusso upload attuale

Da pagina Upload:
- scrive `latest/[line]/[lang]/[doc-type].pdf`
- scrive `legacy/[line]/[lang]/[doc-type]_[date].pdf`
- aggiorna `assets/latest-index.json` (upsert entry stessa `line/lang/docType`)

## Dati mostrati in FE

- Tab `Documenti` e `Ufficiali` leggono `assets/latest-index.json`.
- Cache locale indice: chiavi `webterms_cached_latest_index*`.

Reset cache rapido (browser console):

```js
localStorage.removeItem('webterms_cached_latest_index');
localStorage.removeItem('webterms_cached_latest_index_ttl');
```

## API richiesta per operazioni admin

Operazioni:
- upload
- soft delete
- restore
- hard delete

Senza API attiva: upload/delete/restore/hard-delete non funzionano.

## Troubleshooting

### Documento caricato ma non visibile

1. Controlla `assets/latest-index.json` live.
2. Hard refresh browser (`Cmd+Shift+R`).
3. Pulisci cache `webterms_cached_latest_index*`.
4. Verifica deploy FE aggiornato.

### Errore 401/403 su API PHP

Controlla `GITHUB_ADMIN_TOKEN` in `frontend/public/webterms.env.php`.
