# Frontend WebTerms

Backoffice Angular per upload, gestione documenti, vista ufficiale.

## Requisiti

- Node LTS 22 (`.nvmrc` root repo).
- Backend admin avviato su `127.0.0.1:8787` per delete/restore/hard-delete.

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
- `/api/admin/*` -> `http://127.0.0.1:8787/api/admin/*`
- `/webterms/api/*` -> rewrite `/api/*` (utile con base `/webterms/`)

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

- Tab `Documenti` e `Ufficiali` prova prima manifest pubblico.
- Se manifest non disponibile, fallback su `assets/latest-index.json`.
- Cache locale manifest: chiavi `webterms_cached_manifest*`.

Reset cache rapido (browser console):

```js
localStorage.removeItem('webterms_cached_manifest');
localStorage.removeItem('webterms_cached_manifest_ttl');
```

## Backend admin richiesto per operazioni distruttive

Operazioni:
- soft delete
- restore
- hard delete

Senza backend attivo: upload può funzionare (GitHub API da FE), ma delete/restore no.

## Troubleshooting

### Documento caricato ma non visibile

1. Controlla `assets/latest-index.json` live.
2. Hard refresh browser (`Cmd+Shift+R`).
3. Pulisci cache `webterms_cached_manifest*`.
4. Verifica deploy FE aggiornato.

### Errore 401/403 su admin API

Controlla variabile `GITHUB_ADMIN_TOKEN` nel backend.
