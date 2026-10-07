# job-match – Job-Match- & Interview-Assistent

job-match begleitet Bewerbende von der Stellenanzeige bis zur Zusage. Man lädt seinen Lebenslauf
als PDF hoch; die KI analysiert ihn einmal. Die App zeigt passende Stellen aus einem Stellen-Pool
(Deutschland), bewertet, wie gut man zu einer Stelle passt (Score, Stärken, Lücken, Tipps), und übt
das Vorstellungsgespräch: Der Bot stellt Fragen, bewertet die Antworten und gibt Feedback.
Bewerbungen, Status und Notizen werden gespeichert.

Das Projekt ist zugleich ein Lernprojekt für den Bau von LLM-Anwendungen mit der **Claude API**:
Jede Stufe führt ein neues Thema ein – von Streaming über Structured Outputs, Tools und Agenten bis
zu Prompt Caching, RAG und MCP. Jeder Prompt folgt einer festen, begründeten Methode, und jede
KI-Funktion hat eine Beispiel-Suite (Evals).

## Stand

**Stufe 1 (Konto + Coach-Chat) steht:** Anmelden mit opaken Tokens, Chat mit dem Karriere-Coach
(Antworten live per Server-Sent Events, Stopp, „Erneut versuchen“), gespeicherte Gespräche
(auflisten, umbenennen, löschen), Auswahl von Qualität und Gründlichkeit, Beispiel-Suite für den
Coach-Prompt. Als Nächstes Stufe 2 (Lebenslauf und Profil). Plan: [docs/STUFEN.md](docs/STUFEN.md).

## Dokumentation

- [docs/IDEE.md](docs/IDEE.md) – **Die App-Idee** ohne Technik: was man mit der App machen kann,
  Entscheidungen, fachliche Roadmap.
- [docs/STUFEN.md](docs/STUFEN.md) – **Stufenplan**: Reihenfolge, Aufgaben, Prompt-Units und
  Lernziele je Stufe.
- [docs/STACK.md](docs/STACK.md) – **Tech Stack, Struktur und Stil**. Verbindlich für neuen Code.
- [docs/app-prompting-anchor.md](docs/app-prompting-anchor.md) – **Wie Prompts geschrieben werden**
  (nach Berryman & Ziegler, _Prompt Engineering for LLMs_). Verbindlich für jeden Prompt der App.
- [backend/evals/coach_chat/bericht.md](backend/evals/coach_chat/bericht.md) – **Bericht zur
  Prompt-Verbesserung des Coachs**: Befunde, Prompt-Änderungen v1 bis v4 und ihre gemessene Wirkung.

## Tech Stack

- **Backend:** Node.js 24, Express 5, TypeScript, Zod, Drizzle ORM, Anthropic-SDK
- **Datenbank:** PostgreSQL 17 + pgvector (Docker Compose, Host-Port 5433)
- **Frontend:** Vue 3, Vite, TypeScript, Tailwind CSS v4, shadcn-vue, Pinia
- **Gemeinsam:** pnpm-Workspace; Zod-Schemas des API-Vertrags in `shared/`
- **Qualität:** ESLint, Prettier, `tsc`/`vue-tsc`, Vitest, supertest; GitHub Actions

## Schnellstart

Einmalig: [Docker](https://docs.docker.com/get-started/), [Node.js 24](https://nodejs.org/) und
[pnpm](https://pnpm.io/) installieren, dann `.env` anlegen:

```bash
cp .env.example .env   # ANTHROPIC_API_KEY eintragen
```

```bash
docker compose up -d   # PostgreSQL 17 + pgvector auf Host-Port 5433, legt auch jobmatch_test an
```

```bash
pnpm install && pnpm db:migrate
```

```bash
pnpm dev               # Backend auf :8000 und Frontend auf :5173 gleichzeitig
```

Konten gibt es nur über ein Skript (fragt das Passwort ab, mindestens 10 Zeichen). Für eine
bestehende E-Mail setzt es das Passwort neu:

```bash
pnpm user:create dev@example.com
```

Danach: <http://localhost:5173> (Anmelden, dann Chat). Der
Vite-Dev-Server leitet `/api` an das Backend weiter.

## Befehle

Alle im Wurzelordner; sie laufen über alle Pakete (`backend`, `frontend`, `shared`).

| Befehl                                    | Zweck                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`                                | Backend (`tsx watch`) und Frontend (Vite) mit Neustart                        |
| `pnpm lint`                               | ESLint                                                                        |
| `pnpm format` / `pnpm format:check`       | Prettier                                                                      |
| `pnpm typecheck`                          | `tsc` bzw. `vue-tsc`                                                          |
| `pnpm test`                               | Vitest mit Mock-Client (Backend-Tests gegen Test-DB)                          |
| `pnpm test:integration`                   | Backend gegen echtes Modell (z.ai, kostet wenig, nie in CI)                   |
| `pnpm db:generate`                        | neue Migration aus den `*.tables.ts` erzeugen (drizzle-kit)                   |
| `pnpm db:migrate`                         | Migrationen anwenden                                                          |
| `pnpm user:create <email>`                | Konto anlegen oder Passwort neu setzen                                        |
| `pnpm jobs:import <n> ["<was>"] ["<wo>"]` | bis zu `n` Stellen der Bundesagentur, ohne Ort verteilt auf alle Bundesländer |
| `pnpm eval coach_chat v1`                 | Fassung `v1` der Beispiel-Suite, **echtes** Modell (z.ai)                     |
| `/glm-fassung v3` (in Claude Code)        | Fassung `v3` erzeugen und Paare mit der Vorgängerfassung bilden               |
| `pnpm soma coach_chat vorbereiten v1 v2`  | Paare aus zwei Fassungen bilden, dann `/soma-bewertung v1-v2` in Claude Code  |
| `pnpm soma coach_chat auswerten v1-v2`    | Zählen, wo welche Fassung besser war                                          |

Einzelnes Paket: `pnpm --filter @job-match/backend run test` (bzw. `frontend`, `shared`).

## Umgebungsvariablen

Alle Werte werden beim Start mit Zod geprüft; fehlt oder passt etwas nicht, startet das Backend
nicht und nennt jedes Problem einzeln.

| Variable              | Pflicht | Default                     | Bedeutung                                                      |
| --------------------- | ------- | --------------------------- | -------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | ja      | –                           | Key des Anbieters; `changeme` wird abgelehnt                   |
| `DATABASE_URL`        | ja      | –                           | PostgreSQL-URL (Host-Port 5433 aus Compose)                    |
| `TEST_DATABASE_URL`   | Tests   | –                           | Test-DB `jobmatch_test`; ohne sie werden DB-Tests übersprungen |
| `PORT`                | nein    | `8000`                      | Port des Backends (Ziel des Vite-Proxys)                       |
| `ANTHROPIC_BASE_URL`  | nein    | `https://api.anthropic.com` | Anthropic-kompatibler Endpunkt; bestimmt die Modell-IDs        |
| `LLM_MAX_TOKENS`      | nein    | `16000`                     | maximale Antwortlänge inklusive Thinking                       |
| `LLM_TIMEOUT_SECONDS` | nein    | `60`                        | Timeout bis zum Beginn der Antwort                             |
| `LLM_MAX_RETRIES`     | nein    | `2`                         | Wiederholungen des SDK bei 429, 5xx, Verbindungsfehlern        |
| `LOG_LEVEL`           | nein    | `info`                      | `fatal`, `error`, `warn`, `info`, `debug` oder `trace`         |
| `CHAT_HISTORY_LIMIT`  | nein    | `40`                        | so viele letzte Nachrichten gehen pro Chat-Anfrage ans Modell  |

## API (Stufe 1 und 2)

Alle Routen unter `/api`; Fehler haben die Form `{ "error": { "code", "message" } }`. Ab Konto-Routen
außer Login: `Authorization: Bearer <token>`.

| Route                                 | Zweck                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /auth/login`                    | Token holen (30 Tage gültig); 10 Fehlversuche je 15 Min. und IP                |
| `POST /auth/logout`, `GET /auth/me`   | Token ungültig machen / angemeldeten Nutzer lesen                              |
| `GET /conversations`                  | eigene Gespräche, neueste Aktivität zuerst                                     |
| `GET/PATCH/DELETE /conversations/:id` | laden (mit Nachrichten), umbenennen, löschen – fremde ID: 404                  |
| `POST /chat`                          | Antwort als SSE: `conversation`, `delta`, `done`, `refusal`, `error`           |
| `GET /cvs`                            | eigene Lebenslauf-Fassungen, neueste zuerst (ohne PDF)                         |
| `POST /cvs`                           | PDF als Body (`application/pdf`, max. 5 MB), Name in `X-File-Name`; wird aktiv |
| `GET /cvs/:id/pdf`                    | Original-PDF der Fassung                                                       |
| `PATCH /cvs/:id`                      | Rolle aus der festen Liste setzen (`{ "role" }`)                               |
| `POST /cvs/:id/activate`              | Fassung wieder aktiv machen, die bisherige geht ins Archiv                     |
| `POST /cvs/delete`                    | `{ "ids": [...] }` löschen, alles oder nichts (fremde ID: 404) – 204           |

`POST /chat` mit `conversationId` und ohne `message` setzt ein Gespräch fort („Erneut versuchen“).
Trennt der Browser die Verbindung, bricht das Backend die Modellanfrage ab und speichert die
bisherige Teilantwort.

## Hinweise

- **Keine Secrets committen** – `.env` ist gitignored, neue Variablen gehören in `.env.example`,
  `backend/src/config.ts` und die Tabelle hier in der README.
- **Postgres-Port:** Compose published den Host-Port **5433** (Container-intern 5432), weil lokal
  häufig bereits ein Postgres auf 5432 läuft.
- **Test-Datenbank bei bestehendem Volume:** `docker/initdb` läuft nur beim allerersten Start. Gab
  es das Volume schon: `docker compose exec db createdb -U jobmatch jobmatch_test`.
- **`pnpm test` ruft kein echtes Modell auf** (Mock-Client). `pnpm test:integration` und
  `pnpm eval …` tun das – nur von Hand, mit `TEST_ANTHROPIC_API_KEY` über z.ai.
