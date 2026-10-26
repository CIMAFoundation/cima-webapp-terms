# Frontend WebTerms

Backoffice Angular per upload, gestione documenti, vista ufficiale.

## Requisiti

- Node LTS 22 (`.nvmrc` root repo).
- PHP con cURL, API avviata su `127.0.0.1:8787` e token GitHub configurato.
- Servizio identità infrastruttura raggiungibile per il login locale.

## Avvio locale

```bash
cd /cima-webapp-terms/frontend
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
cd /cima-webapp-terms
# Solo se non esiste già:
[ -f frontend/public/webterms.env.php ] || cp frontend/public/webterms.env.php.example frontend/public/webterms.env.php
# compila frontend/public/webterms.env.php
php -S 127.0.0.1:8787 -t frontend/public
```

La procedura completa di pubblicazione, i controlli Actions/Pages e i limiti in caso
di guasto sono nel [README principale](../README.md#pubblicare-quando-il-fe-remoto-non-è-raggiungibile).
Accedi nuovamente da localhost; la sessione del sito remoto non è condivisa.
`webterms.env.php` è escluso dagli asset Angular e resta leggibile da PHP sul disco.
In sviluppo anche `api/**` è escluso dagli asset: le richieste devono passare dal
proxy a PHP, altrimenti Angular serve il sorgente invece del JSON. Le API restano
incluse nella build di produzione. Dopo modifiche alla configurazione, riavvia `npm start`.

## Build

```bash
cd /cima-webapp-terms/frontend
npm run build
```

Output: `dist/frontend` (base href/deploy url `/webterms/`).

## Flusso upload attuale

Da pagina Upload:
- scrive `latest/[line]/[lang]/[doc-type].pdf`
- scrive `legacy/[line]/[lang]/[doc-type]_[date].pdf`
- aggiorna `assets/latest-index.json` (upsert entry stessa `line/lang/docType`)

L’intera coda viene inviata alle API in un batch e salvata in un unico commit
sul repository remoto. Il push su `main` attiva **Publish Pages** automaticamente.
Non serve un push dal checkout locale; attendi la riuscita del deploy prima di
considerare i documenti pubblicati.

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
4. Verifica che **Publish Pages** sia riuscita per il commit di upload.

### Errore 401/403 su API PHP

- Se fallisce il login, verifica credenziali e raggiungibilità del servizio identità remoto.
- Per operazioni protette, accedi nuovamente: sessione scaduta, CSRF o ruolo diverso
  da admin/dev possono causare 401/403.
- Se l'errore proviene da GitHub, verifica validità e permessi di `GITHUB_ADMIN_TOKEN`
  in `frontend/public/webterms.env.php`: Contents write per upload, anche Actions write
  per ritiro/ripristino tramite workflow.
- `tokenConfigured: true` nell'health check indica solo che il valore è presente.
