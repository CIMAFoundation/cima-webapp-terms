# Frontend WebTerms

Applicazione Angular per caricare, pubblicare e consultare documenti legali nel repo pubblico `CIMAFoundation/cima-legal-public-docs`.

## Cosa fa

- Upload documenti con metadati (`platform`, `docType`, `lang`, `effectiveDate`).
- Aggiornamento del manifest pubblico `legal-docs/manifests/latest.json`.
- Gestione documenti attivi/eliminati (soft delete, restore, hard delete).
- Vista ufficiale del manifest pubblico.
- Monitoraggio GitHub Actions post-upload.

## Struttura essenziale

```text
frontend/
  src/app/
    pages/        # login, upload, documents, official
    components/   # lista documenti e componenti upload
    services/     # query/command GitHub, config runtime, facade upload
```

## Requisiti

- Node.js LTS (consigliato 20.x o 22.x)
- npm

## Avvio locale

```bash
cd frontend
npm ci
npm start
```

URL dev: `http://localhost:4200`

## Build

```bash
cd frontend
npm run build
```

## Configurazione runtime (pagina Upload)

La configurazione è salvata in `localStorage`.

Campi principali:

- manifest URL pubblico
- token GitHub
- owner/repo/branch
- `documentsRootPath`
- `manifestPath`
- `publicBaseUrl`

Default principali:

- Manifest: `https://cimafoundation.github.io/cima-legal-public-docs/legal-docs/manifests/latest.json`
- Fallback: `https://raw.githubusercontent.com/CIMAFoundation/cima-legal-public-docs/main/legal-docs/manifests/latest.json`
- Repo: `CIMAFoundation/cima-legal-public-docs`
- Branch: `main`
- Root documenti: `legal-docs/files`
- Manifest path: `legal-docs/manifests/latest.json`

## Flusso operativo

1. Login.
2. Vai su Upload e verifica la configurazione GitHub.
3. Carica i file e compila i metadati richiesti.
4. Pubblica.
5. Attendi lo stato delle Actions nel pannello monitor.
6. Usa `Aggiorna ora` per riallineare cache e dati.

## Operazioni documenti

- **Soft delete**: imposta `deletedAt` nel manifest.
- **Restore**: rimuove `deletedAt`.
- **Hard delete**: elimina file dal repo e rimuove la voce dal manifest.

Le azioni sono disponibili in selezione multipla dalla tabella.

## Troubleshooting rapido

### Upload multiplo: passa il primo, poi errore

Il sistema usa retry su conflitti GitHub (`409/412`), ma in caso di contese prolungate:

- attendi fine `Publish Manifest`;
- riprova la pubblicazione dei file in errore.

### Refresh su sottopagine porta a not-found

Se il server non ha rewrite SPA, usa router hash-based (`#/documents`, `#/upload`).

### Dato non aggiornato subito

Normale latenza: commit -> action -> GitHub Pages/CDN -> webapp.

## Sicurezza

- Il token è lato browser (`localStorage`): usarlo solo in ambienti controllati.
- Servono permessi repo write e `actions:read` per monitor.
- Non condividere export config contenenti token.