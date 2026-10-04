# Tech Stack, Struktur und Stil

Dieses Dokument ist die **verbindliche Referenz**, wie in diesem Repo Code aufgebaut und
geschrieben wird – für Menschen und für KI-Agenten. Bevor du Dateien anlegst oder verschiebst:
erst hier nachsehen, dann einen bestehenden Domänen-Ordner als Vorlage nehmen. Weicht ein Wunsch
davon ab, erst nachfragen und dieses Dokument anpassen.

Was die App fachlich kann: [IDEE.md](IDEE.md). In welcher Reihenfolge gebaut wird:
[STUFEN.md](STUFEN.md). Wie Prompts geschrieben werden:
[app-prompting-anchor.md](app-prompting-anchor.md). Befehle: [../README.md](../README.md).

> **Stand:** Oktober 2026, Neustart mit Express. Versionen und Bibliotheken vor jeder Stufe gegen
> die offizielle Doku prüfen.

**Leitlinie: einfach vor vollständig.** Der Schwerpunkt ist die KI im Produkt (Structured Outputs,
Tool Use mit eigener Agent-Schleife, Evals, Kosten und Tokens, Abwehr von Prompt Injection), nicht
die Node.js-Architektur. Es gibt nur Code, den der Entwickler versteht und selbst erklären kann;
was nicht gebraucht wird, wird gelöscht. Dateien bleiben dünn.

---

## 1. Tech Stack

| Bereich           | Technik                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Laufzeit          | Node.js 24 (LTS), TypeScript strict, ES-Module                                           |
| Pakete            | **pnpm**-Workspace (`backend`, `frontend`, `shared`), ein Lockfile im Wurzelordner       |
| Backend           | **Express 5**, `tsx` für Entwicklung und Skripte                                         |
| Validierung       | **Zod** – ein Schema für Request, Response, Konfiguration und Structured Outputs         |
| LLM               | `@anthropic-ai/sdk` (offizielles SDK); Anbieter über `ANTHROPIC_BASE_URL`                |
| Datenbank         | PostgreSQL 17 + pgvector (Docker Compose), **Drizzle ORM** + `drizzle-kit` (Migrationen) |
| Auth              | eigene opake Tokens (nur SHA-256-Hash in der DB), Passwort-Hash mit `scrypt` (Node)      |
| Rate-Limit        | `express-rate-limit` für den Login (Zähler im Speicher, eine Instanz)                    |
| Logging           | `pino` + `pino-http` mit Redaction                                                       |
| Backend-Qualität  | ESLint + Prettier, `tsc --noEmit`, **Vitest** + supertest                                |
| Frontend          | Vue 3 (`<script setup lang="ts">`), Vite, TypeScript strict, Tailwind CSS v4, shadcn-vue |
| Frontend-Logik    | Pinia, Vue Router, Typen und Schemas aus `shared`, markdown-it + DOMPurify               |
| Frontend-Qualität | ESLint + Prettier, Vitest, `vue-tsc`                                                     |
| CI                | GitHub Actions: Lint, Typen und Tests für Backend und Frontend bei jedem Push            |

**Warum so:** Express ist bekannt, klein und ohne Magie – jede Zeile zeigt, was passiert. Der
Schwerpunkt des Projekts ist die Claude API, nicht das Web-Framework. TypeScript und Zod geben die
Sicherheit, die ein Framework sonst mitbringt: Ein Zod-Schema beschreibt einen Vertrag **einmal** –
für die Prüfung im Backend, die Typen im Frontend und die Structured Outputs des Modells. Dafür liegt
es im Paket `shared`, das beide Seiten importieren.

Neue Abhängigkeiten nur, wenn der vorhandene Stack die Aufgabe nicht abdeckt, und dann im passenden
Paket (`pnpm --filter <paket> add …`).

---

## 2. Repo-Struktur

```
backend/              Express-App (TypeScript)
  src/                Anwendungscode
  drizzle/            Migrationen (generiert, geprüft, nicht von Hand umgeschrieben)
  test/               Vitest-Tests
  evals/              Beispiel-Suites je Prompt-Unit (siehe §7)
frontend/             Vue-App (TypeScript)
shared/               Zod-Schemas und Typen des API-Vertrags (Backend + Frontend)
docs/                 IDEE, STUFEN, STACK, Prompt-Regeln
docker-compose.yml    Postgres 17 + pgvector (Host-Port 5433)
docker/initdb/        SQL beim ersten Start des DB-Containers (legt jobmatch_test an)
pnpm-workspace.yaml   Workspace-Pakete
.github/workflows/    CI: Lint, Typen und Tests für Backend und Frontend
```

---

## 3. Backend-Struktur (`backend/src`)

### 3.1 Ordner = Domäne

Jede Domäne (ein fachlicher Bereich mit eigenen Daten und Regeln, z. B. `auth`, `conversations`,
`profile`) bekommt **einen Ordner** mit höchstens vier Dateien; jede trägt den Domänennamen als
Präfix:

```
src/
  index.ts              Startpunkt: Config, Logger, Datenbank, LLM-Client bauen, Server starten
  app.ts                createApp({ db, llm, logger, config }): Express-App mit allen Routern
  config.ts             Konfiguration aus .env, mit Zod beim Start geprüft
  db.ts                 Drizzle-Verbindung (`createDatabase`, Typ `Db`)
  logger.ts             pino-Logger mit Redaction, ohne Inhalte
  errors.ts             `AppError` und zentrale Fehler-Middleware
  llm/
    client.ts           Anthropic-Client, Antworttext, Kostenprotokoll (`logLlmCall`)
    models.ts           Modell-Zuordnung je Anbieter
    errors.ts           SDK-Fehler → Code und Nutzermeldung
  <domäne>/
    <domäne>.router.ts      HTTP: Routen, Eingabe mit Zod prüfen, Service aufrufen, antworten
    <domäne>.service.ts     Fachlogik und Drizzle-Abfragen; Fehlerklassen der Domäne
    <domäne>.tables.ts      Drizzle-Tabellen der Domäne
    <domäne>.prompts.ts     nur wenn die Domäne ein Modell aufruft: Prompt-Units
```

Die Zod-Schemas des API-Vertrags (Ein- und Ausgaben) liegen in `shared/src/<domäne>.ts`, damit das
Frontend dieselben Typen benutzt. `requireAuth` und `getAuth` liegen in `auth.router.ts`; andere
Router importieren sie von dort.

### 3.2 Aufgaben der Dateien

- **router → service**, nie rückwärts.
- Der **Router** prüft die Eingabe mit dem Zod-Schema aus `shared`, ruft eine Service-Funktion auf
  und schickt das Ergebnis. Fehler wirft er weiter; die zentrale Fehler-Middleware macht daraus den
  HTTP-Code.
- Der **Service** ist eine Sammlung normaler Funktionen. Jede bekommt `db` (und, wenn nötig, den
  Anthropic-Client) als ersten Parameter und schreibt ihre Drizzle-Abfragen selbst – es gibt keine
  Repository-Schicht. Jede Abfrage auf Nutzerdaten filtert nach `userId`.
- Andere Domänen werden nur über ihre Service-Funktionen benutzt, nie über ihre Tabellen.

Wer aus Laravel kommt: Router ≈ Controller, Service ≈ Service-Klasse mit Query Builder, Tabellen ≈
Migration + Model, Zod-Schema ≈ FormRequest + API-Resource.

### 3.3 Verdrahtung

- Keine globalen Objekte und kein DI-Container. `index.ts` baut `db`, LLM-Client, Logger und Config
  und gibt sie an `createApp`; die Router bekommen davon, was sie brauchen
  (`createAuthRouter(db)`, `createChatRouter({ db, llm, logger, config })`).
- Der Anthropic-Client ist immer ein Parameter (Typ `Anthropic` aus dem SDK), nie ein Import im
  Service. Es gibt kein eigenes Interface dafür; Tests übergeben einen Mock (siehe §5).

### 3.4 Neue Domäne anlegen (Checkliste)

1. Ordner `src/<domäne>/` mit `tables`, `service`, `router` (und `prompts`, falls nötig).
2. Migration mit `pnpm db:generate` erzeugen und prüfen (`drizzle-kit` findet alle
   `*.tables.ts` selbst).
3. Zod-Schemas in `shared/src/<domäne>.ts`, Router in `app.ts` einhängen.
4. Tests mit Mock-Client, für Modellabläufe zusätzlich Integrationstests (siehe §5) und Beispiel-Suite.

---

## 4. Stil

### TypeScript

- `strict` an; kein `any`. Rückgabetypen nur ausschreiben, wenn TypeScript sie nicht klar aus dem
  Code erkennt.
- Ein `interface` nur, wenn es mehr als eine Implementierung gibt – nicht als Name für einen
  einzelnen Rückgabewert. Keine Fabrik-Funktionen für Services; normale Funktionen mit `db` als
  Parameter.
- `async`/`await` für I/O (HTTP, DB, LLM); Express 5 leitet Fehler aus `async`-Handlern selbst an die
  Fehler-Middleware weiter – kein `try/catch` nur zum Weiterreichen.
- Daten von außen (Request, `.env`, Modellantwort) werden mit Zod geprüft, bevor der Code ihnen
  traut. Was nur unser eigener Code in die Datenbank schreibt, wird beim Lesen nicht erneut geprüft;
  die Spalten tragen ihren Typ per `$type<…>()`. Abfragen holen nur die Spalten, die die Antwort
  braucht, statt Zeilen nachträglich umzubauen. Interne Werte sind `readonly`-Typen; keine losen Objekte ohne Typ.
- Fehler: eigene Fehlerklassen je Domäne mit HTTP-Status; die Fehler-Middleware übersetzt sie.
  SDK-Fehler über die Fehlerklassen des SDK unterscheiden (`instanceof`), nie über den Meldungstext.
- Formatierung mit Prettier, Lint mit ESLint (`typescript-eslint`), Zeilenlänge 100.

### Sprache und Kommentare

- Bezeichner, Datei- und Ordnernamen auf **Englisch**.
- UI-Texte und Fehlermeldungen an Nutzer auf **Deutsch**.
- **Keine Kommentare im Code** (weder `/** … */` noch `//`). Klare Namen und kleine Funktionen
  erklären den Code; das Warum steht in `docs/` oder im Commit-Body.

### Sicherheit (bleibt gültig bei jeder Änderung)

- Tokens und Passwörter nie loggen oder im Klartext speichern (Token: SHA-256-Hash, Passwort:
  `scrypt` mit Salt).
- Zugriff auf Nutzerdaten immer mit `userId` einschränken; fremde Datensätze verhalten sich wie
  „nicht vorhanden“ (404).
- Logs enthalten nie Inhalte (Nachrichten, Lebensläufe, Anzeigen) – nur IDs, Längen, Tokens, Dauer.
  `pino` schwärzt Header und Felder wie `password`, `content` zusätzlich (Redaction).
- Fremde Texte (Lebenslauf, Stellenanzeigen, Web-Ergebnisse) sind **Daten, keine Anweisungen**: Sie
  gehen markiert in den Prompt (Prompt-Regeln AP-23), und was gelten muss, prüft der Code.
- Keine Secrets committen; neue Variablen in `.env.example`, `config.ts` und die README-Tabelle.

### Datenbank

- Schema nur in den `<domäne>.tables.ts`; Änderungen **immer** als Migration mit `drizzle-kit`.
- Tabellen und Spalten `snake_case` in der DB, `camelCase` im Code (Drizzle bildet ab); IDs `uuid`,
  Zeiten `timestamptz`.
- Index für jede Abfrage, die nach Spalte filtert und sortiert.

### Prompts

- Jeder Prompt folgt verbindlich [app-prompting-anchor.md](app-prompting-anchor.md) (Reihenfolge
  in §7, harte Regeln in §11).
- Prompt-Units liegen in der `<domäne>.prompts.ts` ihrer Domäne. Ihr Steckbrief (Archetyp, Surface,
  Slots, Stopp, was der Code erzwingt) steht in [STUFEN.md](STUFEN.md), nicht im Code.
- Im Prompt-Text stehen keine Anchor-IDs (`AP-xx`) und keine Verweise auf Dateien.

---

## 5. Tests

- **Unit-Tests** (`pnpm test`, laufen in CI) rufen nie ein echtes Modell auf. Wo ein Service den
  Client braucht, bekommt er einen Mock, dessen `messages.stream` eine feste Antwort liefert. So wird
  der eigene Code geprüft: gesendeter Prompt, SSE-Events, Stopp-Gründe, Fehler, was gespeichert wird.
  Dazu Eingabe-Validierung, Zugriff (401/404), Datenbank-Abfragen, Prompt-Bau und Schemas.
- **Integrationstests** (`pnpm test:integration`, `test/integration/`) rufen das **echte** Modell
  auf, ohne Mock. Sie prüfen Eigenschaften statt Wortlaut: Stopp-Grund, nicht leere Antwort, Tokens,
  Event-Folge, Fehlercodes. Für Testläufe dient z.ai (`TEST_ANTHROPIC_API_KEY`,
  `TEST_ANTHROPIC_BASE_URL`, Default z.ai), weil Claude dafür zu teuer ist. Ohne Key werden sie
  übersprungen; sie laufen nur von Hand, nie in CI.
- Service- und Router-Tests laufen gegen die eigene Test-Datenbank `jobmatch_test`
  (`TEST_DATABASE_URL`); `useTestDb()` aus `test/helpers.ts` liefert `db`, eine App und angemeldete
  Test-Nutzer und räumt am Ende auf. Ohne `TEST_DATABASE_URL` werden diese Tests übersprungen. Tests
  sehen aus der `.env` nur Variablen mit `TEST_`-Präfix – nie API-Key oder Entwicklungsdatenbank.
- Frontend-Specs nur für Sicherheit und Datenfluss: Markdown ohne HTML, API-Client und Token,
  Chat-Stream, Router-Guard, Login-Weiterleitung, Chat-Store. Die Oberfläche prüft der Entwickler
  von Hand.
- Testnamen beschreiben das Verhalten (`'login with wrong password returns 401'`).
- Vor jedem Commit grün: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`.

---

## 6. Frontend-Struktur (`frontend/src`)

```
pages/        Seiten (eine je Route)
components/   wiederverwendbare Komponenten; components/ui/ = shadcn-vue (eigener Code)
stores/       Pinia-Stores (Setup-Syntax)
lib/          Hilfen ohne Vue-Bezug (API-Client mit Token, Chat-Stream, Markdown)
```

- API-Aufrufe nur über den Client aus `lib/`; Typen und Antwort-Prüfung über die Schemas aus
  `shared`. Streaming (SSE) über `fetch` + `ReadableStream`.
- Markdown aus Modellantworten nur über markdown-it + DOMPurify, ohne rohes HTML und ohne Bilder.

---

## 7. Evals (Beispiel-Suites)

Jede Prompt-Unit bekommt ab ihrer ersten Version eine Beispiel-Suite (Prompt-Regeln AP-56):

```
backend/evals/<prompt-unit>/
  cases/        5–20 repräsentative Eingaben (JSON)
  run.ts        baut den Prompt wie die App, holt die Antwort, schreibt outputs/
  outputs/      committete Antworten – ihr Diff zeigt, was eine Prompt-Änderung bewirkt
```

- Evals rufen das **echte** Modell auf und kosten Geld: nur bewusst und von Hand starten
  (`pnpm eval <prompt-unit>`), nie in CI.
- Jeder Lauf protokolliert Modell, Effort, Tokens und Dauer (AP-58).
- Sobald eine Unit ein festes Ergebnis hat (z. B. Score), kommen prüfbare Kriterien dazu.

---

## 8. Commits

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), ein Thema pro
  Commit.
- Commit-Text auf Englisch, kurz; das Warum in den Body.
