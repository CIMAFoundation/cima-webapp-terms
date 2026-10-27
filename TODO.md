# Procedura locale quando Webterms remoto non è disponibile

Procedura verificata il 27 ottobre 2026: login e caricamento riusciti.
Questa checklist serve a ogni nuovo avvio. L'app e il login funzionano in locale;
per caricare i documenti e pubblicarli servono Internet, GitHub e Pages operativi.

## Prima dell'avvio

- [ ] Verificare PHP con estensioni cURL e SQLite3 e Node 22.
- [ ] Verificare che `infrastruttura-nf/api/database.sqlite` contenga l'account
  locale da usare, con ruolo `admin` oppure `dev`.
- [ ] Conservare la configurazione esistente in `frontend/public/webterms.env.php`:
  token GitHub valido, repository `CIMAFoundation/cima-legal-public-docs`, branch `main`.
- [ ] Per il login locale, verificare nello stesso file questa voce:

```php
'INFRA_AUTH_URL' => 'http://127.0.0.1:8788/auth.php',
```

Non sovrascrivere il file riservato con l'example e non aggiungerlo a Git.

## Avviare tre terminali e lasciarli aperti

- [ ] **Terminale 1: autenticazione locale.** Avviare dalla cartella del database.

```bash
cd /Users/deda/WebstormProjects/infrastruttura-nf/api
php -S 127.0.0.1:8788 -t .
```

- [ ] **Terminale 2: API Webterms.**

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms
php -S 127.0.0.1:8787 -t frontend/public
```

- [ ] **Terminale 3: frontend Webterms.**

```bash
cd /Users/deda/WebstormProjects/cima-webapp-terms/frontend
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use
npm start
```

Eseguire `npm ci` prima di `npm start` solo se mancano le dipendenze o se è cambiato
`package-lock.json`. Non serve una build per avviare l'app in locale.
Non occorre avviare il frontend infrastruttura o il backend Node legacy.

## Login, caricamento e controllo finale

- [ ] Aprire `http://localhost:4200/api/health.php`: `ok`, `curlAvailable` e
  `tokenConfigured` devono essere `true`. Il controllo non verifica il login
  o i permessi effettivi del token GitHub.
- [ ] Aprire `http://localhost:4200` e accedere con le credenziali del database
  locale: possono differire da quelle online. La sessione remota non è condivisa.
- [ ] Controllare portale, lingua, tipo e data per ogni PDF e pubblicare la coda.
  Stessa combinazione portale/lingua/tipo sostituisce il PDF corrente in `latest`.
- [ ] Controllare il commit creato dall'upload nel repository documenti.
  Non serve un ulteriore push dalla copia locale.
- [ ] Attendere **Publish Pages** verde e verificare elenco e PDF pubblici su
  [GitHub Pages](https://cimafoundation.github.io/cima-legal-public-docs/).
- [ ] Prima di futuri commit manuali nel repository documenti, aggiornare il ramo
  dal remoto: l'upload ha già modificato `main`. Non ripristinare un indice locale obsoleto.

## Se qualcosa non funziona

- **Login `503`:** controllare prima che il terminale 1 sia ancora attivo sulla
  porta `8788`. Il 27 ottobre mancava proprio questo servizio.
- **Login `401`:** controllare le credenziali del database locale.
- **Upload `401`:** accedere nuovamente; la sessione server dura un'ora.
- **Upload `403`:** verificare ruolo `admin`/`dev` e rifare login.
- **Porta già occupata:** controllare se il servizio è già avviato in un altro
  terminale; non avviarne una seconda copia.
- **Errore dopo il salvataggio:** controllare commit e Action prima di ripetere
  l'upload. Il salvataggio GitHub e la pubblicazione Pages sono due passaggi distinti.
