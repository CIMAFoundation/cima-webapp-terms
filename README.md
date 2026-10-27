# CIMA Webapp Terms

Monorepo per gestione documenti legali e pubblicazione su GitHub Pages.

Per le prove locali quando l'app remota non è disponibile, seguire la
[checklist TODO: avvio dei tre servizi, login e pubblicazione](TODO.md).

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
- PHP con estensione cURL per le API locali.
- GitHub token con permesso Contents write su `CIMAFoundation/cima-legal-public-docs`;
  per ritiro/ripristino tramite workflow serve anche Actions write.
- Servizio di autenticazione infrastruttura locale oppure online e account admin/dev.

## Avvio locale completo (FE + BE PHP)

Terminale 1 (API PHP):

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms
# Solo se la configurazione locale non esiste già:
[ -f frontend/public/webterms.env.php ] || cp frontend/public/webterms.env.php.example frontend/public/webterms.env.php
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

## Pubblicare quando il FE remoto non è raggiungibile

Avvia FE e API PHP locali come sopra e apri `http://localhost:4200`.
Il proxy Angular inoltra `/api` a `127.0.0.1:8787`: non serve il FE remoto,
né avviare il backend Node legacy o la copia locale del repository pubblico.

1. Verifica `http://localhost:4200/api/health.php`: `ok`, `curlAvailable` e
   `tokenConfigured` devono essere `true`; controlla repo e branch (`main`).
   Questo controllo non verifica validità o permessi del token GitHub.
2. Accedi da localhost con il tuo account: la sessione del sito remoto non viene
   condivisa. Le sessioni API durano un'ora; le operazioni protette richiedono admin/dev.
3. Nella pagina Upload prepara tutti i PDF e controlla portale, lingua, tipo e data.
   Pubblica l'intera coda una sola volta.
4. Le API creano un unico commit remoto con PDF `latest/`, copie `legacy/` e indice
   `assets/latest-index.json`. Non eseguire un ulteriore push locale.
5. Nel repository `CIMAFoundation/cima-legal-public-docs`, controlla che l'Action
   **Publish Pages** relativa al commit termini correttamente. Il push su `main`
   attiva automaticamente il workflow; Pages deve essere configurato su GitHub Actions.
6. Verifica indice e PDF su
   [GitHub Pages](https://cimafoundation.github.io/cima-legal-public-docs/).
   L'upload riuscito conferma la scrittura GitHub, non il deploy concluso;
   considera anche i tempi di propagazione delle cache.

La distribuzione attuale usa GitHub Pages. La pipeline DOCX del repository app
è separata e non viene attivata da questo upload.

### Limiti in caso di guasto

Il login PHP usa `INFRA_AUTH_URL` da `frontend/public/webterms.env.php`.
Il default è `https://mockup.cimafoundation.org/infrastruttura/api/auth.php`.
Per lavorare anche quando il servizio remoto non risponde, avvia le API infrastruttura
in un terzo terminale, dalla cartella che contiene il database SQLite:

```bash
cd /Users/deda/WebstormProjects/infrastruttura-nf/api
php -S 127.0.0.1:8788 -t .
```

In `frontend/public/webterms.env.php` aggiungi:

```php
'INFRA_AUTH_URL' => 'http://127.0.0.1:8788/auth.php',
```

Serve l'estensione PHP SQLite3 e un database locale `database.sqlite` con gli utenti.
Usa le credenziali del database locale: non sono necessariamente allineate a quelle
online. Non serve avviare il frontend infrastruttura. L'API WebTerms legge la
configurazione a ogni richiesta. Per tornare al servizio remoto, rimuovi l'override.
In caso di guasto del servizio identità il login restituisce 503; le credenziali
rifiutate restituiscono 401.

Anche l'elenco portali dipende da infrastruttura e usa un fallback limitato su errore:
verifica che la destinazione desiderata sia presente prima di pubblicare.
Servono inoltre rete verso GitHub, token valido e Actions/Pages operativi.

### Configurazione riservata

`frontend/public/webterms.env.php` è escluso da Git e dagli asset Angular
(sviluppo, build e test). PHP lo legge direttamente dal filesystem.
Non mettere il token in localStorage o nel codice FE e non sovrascrivere una
configurazione esistente con l'example. L'esclusione riguarda il file riservato:
per il deploy PHP sul server, trasferiscilo separatamente con un canale riservato.

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
