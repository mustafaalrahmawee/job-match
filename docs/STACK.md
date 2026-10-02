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
pnpm-workspace.yaml   Workspace-Pakete
.github/workflows/    CI: Lint, Typen und Tests für Backend und Frontend
```

---

## 3. Backend-Struktur (`backend/src`)

### 3.1 Ordner = Domäne, Dateien = Schichten

Jede Domäne (ein fachlicher Bereich mit eigenen Daten und Regeln, z. B. `auth`, `conversations`,
`profile`) bekommt **einen Ordner**. Darin liegen nur die Schichten, die sie braucht; jede Datei
trägt den Domänennamen als Präfix:

```
src/
  index.ts              Startpunkt: Konfiguration laden, App bauen, Server starten
  app.ts                createApp(deps): baut die Express-App, hängt Router und Middleware ein
  config.ts             Konfiguration aus .env, mit Zod beim Start geprüft
  db.ts                 Drizzle-Verbindung (Pool) und Schema-Sammlung
  logger.ts             pino-Logger mit Redaction, ohne Inhalte
  errors.ts             Basis-Fehlerklasse und zentrale Fehler-Middleware
  llm/                  Anthropic-Client, Modell-Zuordnung, Fehlerübersetzung, Streaming-Hilfen
  <domäne>/
    <domäne>.router.ts      HTTP: Routen, Status-Codes, Validierung – keine Fachlogik
    <domäne>.service.ts     Fachlogik; kennt weder Express noch Drizzle
    <domäne>.repository.ts  Datenzugriff: Interface + Drizzle-Implementierung
    <domäne>.tables.ts      Drizzle-Tabellen der Domäne
    <domäne>.middleware.ts  optional: Middleware (z. B. „angemeldet“, „Gespräch gehört dem Nutzer“)
    <domäne>.errors.ts      optional: Fehlerklassen der Domäne
    <domäne>.prompts.ts     optional: Prompt-Units der Domäne (nur wenn sie ein Modell aufruft)
```

Die Zod-Schemas des API-Vertrags (Ein- und Ausgaben) liegen nicht hier, sondern in
`shared/src/<domäne>.ts`, damit das Frontend dieselben Typen benutzt. Gemeinsame Middleware über
Domänen hinweg (z. B. der angemeldete Nutzer) liegt in der Domäne, der sie gehört (`auth`).

### 3.2 Aufgaben der Schichten

- **router → service → repository**, nie rückwärts und nie über eine Schicht hinweg.
- Der **Router** prüft die Eingabe mit dem Zod-Schema aus `shared`, ruft den Service auf und
  übersetzt das Ergebnis in eine Antwort. Fehler wirft er weiter; die zentrale Fehler-Middleware
  macht daraus den HTTP-Code.
- Der **Service** enthält die Regeln (z. B. „nur eine aktive Fassung“). Er bekommt Repository und
  LLM-Client als Parameter, damit Tests sie durch Fakes ersetzen.
- Das **Repository** ist ein TypeScript-`interface` plus eine Drizzle-Implementierung. Jede Abfrage
  auf Nutzerdaten filtert nach `userId`.
- `<domäne>.middleware.ts` enthält nur Verdrahtung und Zugriffsprüfungen, keine Fachregeln;
  `<domäne>.errors.ts` die Fehler, die der Service wirft.
- Andere Domänen werden nur über ihren **Service** benutzt, nie über Repository oder Tabellen.

Wer aus Laravel kommt: Router ≈ Controller, Service ≈ Service-Klasse, Repository ≈ Repository über
Eloquent, Tabellen ≈ Migration + Model, Zod-Schema ≈ FormRequest + API-Resource.

### 3.3 Warum eine eigene Repository-Schicht

Drizzle ist schon fast SQL, viele Projekte rufen es direkt im Service auf. Hier gibt es trotzdem
eine eigene Schicht, weil:

- **Service-Tests ohne Datenbank laufen:** Repository und LLM-Client sind Fakes. Das hält die vielen
  Tests der KI-Abläufe schnell und eindeutig.
- **Die Fachregeln an einer Stelle stehen:** Der Service enthält keine Abfragen, das Repository keine
  Regeln.

Der Preis ist mehr Code bei einfachem Anlegen, Lesen, Ändern und Löschen. Wird eine Domäne so
einfach, dass das Repository nur durchreicht, bleibt es trotzdem – die Struktur soll in allen
Domänen gleich sein.

### 3.4 Verdrahtung

- Keine globalen Objekte und kein DI-Container. Jede Schicht ist eine **Fabrik-Funktion**, die ihre
  Abhängigkeiten als Parameter bekommt: `createAuthService({ repository })`,
  `createAuthRouter({ service })`.
- `createApp(deps)` bekommt Konfiguration, Datenbank und LLM-Client und verdrahtet alles. `index.ts`
  übergibt die echten Objekte, Tests übergeben Fakes.
- Der LLM-Client ist immer ein Parameter, nie ein Import im Service.

### 3.5 Neue Domäne anlegen (Checkliste)

1. Ordner `src/<domäne>/` mit den nötigen Schicht-Dateien.
2. Tabellen in `<domäne>.tables.ts`, Migration mit `pnpm db:generate` erzeugen und prüfen.
3. Zod-Schemas in `shared/src/<domäne>.ts`, Service mit Interface-Abhängigkeiten, Router in
   `app.ts` einhängen.
4. Tests: Service mit Fakes, Router mit supertest gegen `createApp`, Repository gegen die Test-DB.

---

## 4. Stil

### TypeScript

- `strict` an; kein `any`. Rückgabetypen an exportierten Funktionen ausschreiben.
- `async`/`await` für I/O (HTTP, DB, LLM); Express 5 leitet Fehler aus `async`-Handlern selbst an die
  Fehler-Middleware weiter – kein `try/catch` nur zum Weiterreichen.
- Daten von außen (Request, `.env`, Modellantwort, DB-JSON) werden mit Zod geprüft, bevor der Code
  ihnen traut. Interne Werte sind `readonly`-Typen; keine losen Objekte ohne Typ.
- Fehler: eigene Fehlerklassen je Domäne mit HTTP-Status; die Fehler-Middleware übersetzt sie.
  SDK-Fehler über die Fehlerklassen des SDK unterscheiden (`instanceof`), nie über den Meldungstext.
- Formatierung mit Prettier, Lint mit ESLint (`typescript-eslint`), Zeilenlänge 100.

### Sprache und Kommentare

- Bezeichner, Datei- und Ordnernamen auf **Englisch**.
- Kommentare, UI-Texte und Fehlermeldungen an Nutzer auf **Deutsch**.
- Kommentare erklären das **Warum**, nicht das Was.

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
- Prompt-Units liegen in der `<domäne>.prompts.ts` ihrer Domäne und tragen einen Kopfkommentar:
  Archetyp, Surface, Slots, Stopp und was der Code erzwingt.
- Im Prompt-Text stehen keine Anchor-IDs (`AP-xx`) und keine Verweise auf Dateien.

---

## 5. Tests

- **Kein Test ruft ein echtes LLM auf.** Der Client ist ein Fake, der die dokumentierten Antwort-
  und Stream-Formen des SDK nachbildet.
- Service-Tests mit Fakes (schnell, ohne DB); Router-Tests mit supertest gegen `createApp`;
  Repository-Tests gegen eine eigene Test-Datenbank in Postgres.
- Testnamen beschreiben das Verhalten (`'login with wrong password returns 401'`).
- Vor jedem Commit grün: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`.

---

## 6. Frontend-Struktur (`frontend/src`)

```
pages/        Seiten (eine je Route)
components/   wiederverwendbare Komponenten; components/ui/ = shadcn-vue (eigener Code)
stores/       Pinia-Stores (Setup-Syntax)
lib/          Hilfen ohne Vue-Bezug (API-Client, SSE-Parser, Markdown)
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
