# WebTerms Frontend

Applicazione Angular per gestione, pubblicazione e consultazione dei documenti legali
(Terms, Privacy, Cookie) sul repository pubblico `CIMAFoundation/cima-legal-public-docs`.

## Obiettivo del progetto

Il frontend permette di:

- configurare runtime repository/manifest GitHub;
- caricare documenti e pubblicarli nel repo documentale;
- aggiornare automaticamente il `latest.json` (via workflow del repo documentale);
- visualizzare documenti attivi, documenti eliminati, ripristino e cancellazione definitiva;
- mostrare la vista "ufficiale" del manifest pubblico;
- monitorare la pipeline GitHub Actions post-upload e fare refresh controllato.

## Struttura principale

```text
webterms/frontend/
  src/app/
    pages/
      login/
      upload/
      documents/
      official/
    components/
      documents-list/
      upload/
    services/
      runtime-config.service.ts
      auth.service.ts
      auth-api.service.ts
      config-api.service.ts
      documents-api.service.ts
      manifest-query.service.ts
      manifest-command.service.ts
      github-content.repository.ts
      github-actions.service.ts
      upload-facade.service.ts
```

## Architettura (sintesi)

- `ManifestQueryService`: lettura manifest pubblico, fallback URL, cache locale.
- `ManifestCommandService`: operazioni di publish/soft-delete/restore/hard-delete su manifest.
- `GithubContentRepository`: accesso GitHub Contents API (read/write/delete file).
- `DocumentsApiService`: facade leggera che delega query e comandi.
- `UploadFacadeService`: gestione coda upload, validazioni e avanzamento.
- `GithubActionsService`: polling GitHub Actions (`actions:read`) dopo upload.
- `RuntimeConfigService`: persistenza configurazione in `localStorage`.

## Routing applicazione

Le pagine sono caricate lazy (bundle iniziale alleggerito):

- `/login`
- `/upload`
- `/documents`
- `/official-documents`

## Configurazione runtime

La configurazione viene salvata in `localStorage` dalla pagina Upload.
Campi principali:

- `manifestUrl`
- `githubToken`
- `repoOwner`
- `repoName`
- `branch`
- `documentsRootPath`
- `manifestPath`
- `publicBaseUrl`

Default principali:

- Manifest pubblico: `https://cimafoundation.github.io/cima-legal-public-docs/legal-docs/manifests/latest.json`
- Fallback manifest: `https://raw.githubusercontent.com/CIMAFoundation/cima-legal-public-docs/main/legal-docs/manifests/latest.json`
- Repo: `CIMAFoundation/cima-legal-public-docs`
- Branch: `main`
- Root documenti: `legal-docs/files`
- Manifest path: `legal-docs/manifests/latest.json`
- Public base URL: `https://cimafoundation.github.io/cima-legal-public-docs`

## Prerequisiti

- Node.js LTS (consigliato 20.x o 22.x)
- npm

> Nota: versioni Node dispari (es. 25.x) possono funzionare, ma non sono raccomandate
> in produzione dall'ecosistema Node/Angular.

## Avvio locale

```bash
cd webterms/frontend
npm install
npm start
```

Server di sviluppo: `http://localhost:4200` (con proxy da `proxy.conf.json`).

## Build

```bash
cd webterms/frontend
npm run build
```

Build output: `webterms/frontend/dist/frontend`.

## Procedura operativa consigliata

### 1) Login e configurazione

1. Apri `/login` e accedi.
2. Vai su `/upload`.
3. Apri "Configurazione GitHub".
4. Verifica owner/repo/branch/path/URL pubblici.
5. Salva configurazione.

### 2) Upload documenti

1. Trascina o seleziona file.
2. Compila per ogni riga: piattaforma, tipo, lingua (data precompilata).
3. Clicca `Pubblica`.
4. Attendi esito upload (stato riga, snackbar).

### 3) Attesa pipeline GitHub (post-upload)

Dopo un upload con almeno un successo, la pagina mostra un pannello di monitoraggio:

- stato pipeline (`polling`, `success`, `failure`, `timeout`, `error`);
- link a `Actions` della repo configurata;
- link al run corrente (quando trovato);
- pulsante `Aggiorna ora` quando il monitor termina.

`Aggiorna ora` fa:

- clear cache del manifest locale;
- reload completo pagina per riallineare i dati alla pubblicazione.

### 4) Verifica documenti

- `/documents`: lista operativa + filtri + documenti eliminati.
- `/official-documents`: vista ufficiale del `latest.json` pubblico.

## Eliminazioni e ripristino

- **Soft delete**: marca il record con `deletedAt` nel manifest.
- **Restore**: rimuove `deletedAt`.
- **Hard delete**: rimuove file da GitHub + entry dal manifest.

Le operazioni sono disponibili in selezione multipla dalla tabella.

## Caching e latenza (comportamento atteso)

È normale osservare latenza tra upload e visibilità finale:

1. commit/aggiornamento nel repo;
2. workflow `Publish Manifest`;
3. propagazione GitHub Pages/CDN;
4. refresh lato frontend.

Per ridurre l'effetto cache:

- lettura manifest con cache-buster;
- invalidazione cache locale dopo write;
- pulsante `Aggiorna ora` a fine monitor.

## Sicurezza e permessi token

Il token usato dal frontend deve avere almeno:

- permessi repo (scrittura contenuti);
- `actions:read` (monitoraggio workflow run).

Attenzione:

- il token è salvato in `localStorage`;
- l'export configurazione include token.

Usare solo in contesti controllati e non condividere file di export non sanitizzati.

## Troubleshooting rapido

### Upload riuscito ma documento non visibile subito

- Apri pannello monitor Actions e verifica stato run.
- Quando `success`, clicca `Aggiorna ora`.
- In caso di dubbio apri `/official-documents` e confronta con GitHub Pages.

### Errore API GitHub in upload/delete

- Verifica token, owner/repo/branch.
- Verifica path: `documentsRootPath` e `manifestPath`.
- Verifica permessi token (repo write).

### Monitor Actions non parte o fallisce

- Verifica token con `actions:read`.
- Verifica che il workflow sia nominato `Publish Manifest`.
- Usa il link `Actions` e conferma stato run manualmente.

## Comandi utili

```bash
cd webterms/frontend
npm start
npm run build
npm test
```

## Riferimenti

- Repo documentale pubblico: `cima-legal-public-docs`
- Pagina pubblica documenti: `https://cimafoundation.github.io/cima-legal-public-docs/`
- GitHub Actions repo documentale: `https://github.com/CIMAFoundation/cima-legal-public-docs/actions`
