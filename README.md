# CIMA Webapp Terms

Monorepo per gestione e pubblicazione documenti legali (terms/privacy/cookie).

## Struttura principale

- `frontend/`: webapp Angular di backoffice (login, upload, documenti, vista ufficiale).
- `cima-legal-public-docs/`: repository pubblico con file e `latest.json` usato dai client.
- `webterms/`: cartella legacy mantenuta come ponte documentale.
- `docs/public-repo-publication-blueprint.md`: blueprint architetturale del flusso.
- `test-docs/`: file di test per prove upload.

## Flusso sintetico

1. Operatore usa `frontend/` e pubblica documenti con metadati.
2. Il frontend scrive file + manifest su `cima-legal-public-docs` via GitHub API.
3. Le GitHub Actions normalizzano `latest.json`.
4. GitHub Pages espone i contenuti pubblici.

## Avvio rapido

### Frontend

```bash
cd frontend
npm ci
npm start
```

### Build frontend

```bash
cd frontend
npm run build
```

### Repo pubblico documenti

```bash
cd cima-legal-public-docs
npm ci
npm run validate:legal-docs
npm run build:manifest
```

## Documentazione

- Guida frontend: `frontend/README.md`
- Guida repo pubblico: `cima-legal-public-docs/README.md`
- Blueprint tecnico: `docs/public-repo-publication-blueprint.md`

## Nota migrazione cartelle

La cartella applicativa è stata spostata da `webterms/frontend` a `frontend` per semplificare il repository.
