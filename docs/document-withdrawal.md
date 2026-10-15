# Ritiro reversibile dei documenti

Il ritiro è disponibile solo a `admin` e `dev`. La tab **Ritirati** legge l'indice
completo tramite API autenticata, mentre Pages espone solo le righe attive.
I PDF rimangono nel repository pubblico: il ritiro non ne rende privato il contenuto.
Gli URL `latest/...pdf` ritirati vengono esclusi dall'artefatto di Pages e rispondono
404 dopo il deploy e la scadenza delle cache. Le versioni storiche in `legacy/`
restano pubblicate: il ritiro riguarda il documento corrente selezionato.

## Flusso

1. Il login passa dall'API PHP di Webterms, che verifica le credenziali presso
   `infrastruttura/api/auth.php` e crea una sessione HTTP-only di un'ora.
2. Le API di ritiro/ripristino verificano sessione, ruolo e token CSRF.
3. Dopo la conferma, l'API avvia `publish-pages.yml` nel repository pubblico.
4. La CI aggiorna `deletedAt` nell'indice del repository con un commit. I PDF
   originali restano invariati. La rigenerazione dell'indice conserva lo stato.
5. Il deploy costruisce un sito separato, senza PDF ritirati né relative righe.
   Il ripristino ripubblica gli stessi PDF e gli stessi URL.
6. Webterms mostra che la richiesta è accodata. **Stato CI** apre il workflow;
   **Aggiorna lista** rilegge l'indice dopo il completamento.

La CI ritenta il commit se un altro aggiornamento modifica `main` nel frattempo.
I deploy sono serializzati e costruiscono la versione corrente di `main`.
Un errore CI non deve essere interpretato come ritiro completato; il workflow può
essere rieseguito. `refresh` ricostruisce Pages senza modificare gli stati.

## Attivazione

- Distribuire prima la correzione con query parametrizzata di
  `infrastruttura-nf/api/auth.php`, necessaria a impedire login tramite SQL injection.
- Integrare il branch del repository `cima-legal-public-docs` in `main`.
- In Settings → Pages, scegliere **GitHub Actions** come sorgente di pubblicazione.
  Disabilitare eventuali workflow alternativi che pubblichino l'intero repository.
- Il token server `GITHUB_ADMIN_TOKEN` deve avere accesso al repository pubblico,
  lettura dei contenuti e permesso **Actions: write** per avviare il workflow.
  La CI usa `GITHUB_TOKEN` con `contents: write`, `pages: write`, `id-token: write`.
- Eseguire `Publish Pages` con `action=refresh` per applicare anche i `deletedAt`
  già presenti online, senza ripristinare i documenti ritirati in precedenza.
- Distribuire FE e API PHP di Webterms. Occorrono PHP con cURL e sessioni abilitate.
  Gli utenti già collegati devono effettuare nuovamente il login.
- Per sviluppo, usare l'API PHP: `php -S 127.0.0.1:8787 -t frontend/public`.
  Il vecchio backend Node è deprecato e non gestisce le nuove sessioni.

Prima dell'attivazione i vecchi URL continuano a funzionare. Il rollout richiede
verifica reale: un URL ritirato deve rispondere 404, uno attivo 200; dopo ripristino
lo stesso URL deve tornare 200. Le copie già scaricate dai client restano disponibili.

## Verifiche locali

- `node --test cima-legal-public-docs/scripts/publication.test.mjs`
- `php tests/api/withdrawal.php <caso>` con `anonymous`, `expired`, `viewer`,
  `forged-csrf`, `get`, `missing`, `admin`, `dev`.
- `cd frontend && npm run build` (Node 22).
- `node tests/e2e/document-withdrawal.cjs` con Playwright disponibile in `NODE_PATH`
  e Chrome installato. Usa API simulate e verifica ruoli, ritiro, ripristino e mobile.

Il progetto non definisce uno script `lint`. I test PHP usano fixture e non inviano
richieste a GitHub. I test Node provano esclusione dall'artefatto, conservazione dei
PDF nel repository, ripristino e rigenerazione dell'indice senza ripubblicazione.
