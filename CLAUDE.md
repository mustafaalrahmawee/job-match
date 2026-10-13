# job-match

Neustart (11.10.2026): Die App wird von null mit **Express + TypeScript** (Backend, Entscheidung vom
12.10.2026) und **Vue 3 + Tailwind** (Frontend) gebaut, Stufe für Stufe. Fachliche Idee, Domänenmodell,
Use Cases je Stufe: [docs/APP_IDEA.md](docs/APP_IDEA.md). Nur die aktuelle Stufe
umsetzen.

Jeder Prompt folgt [docs/app-prompting-anchor.md](docs/app-prompting-anchor.md), jede Eval
[docs/app-evaluation-anchor.md](docs/app-evaluation-anchor.md); was je Stufe geprüft wird, steht in
[docs/EVAL_PLAN.md](docs/EVAL_PLAN.md).

Stack steht: `backend/` (Node 22, ESM, TypeScript strict, Express 5, Zod 4, Prisma 7 mit
`@prisma/adapter-pg`, `@anthropic-ai/sdk`, argon2, Vitest + Supertest, ESLint, pnpm; Dev-Server
`tsx watch` auf Port 8000) und `frontend/` (Vue 3, Vite, Pinia, Vue Router, Tailwind v4 mit Theme in
`src/assets/main.css`, pnpm). Datenbank per `docker-compose.yml` (PostgreSQL 17, Host-Port 5433) als
einzige Quelle der Wahrheit; Vektorsuche ab Stufe 7 mit ChromaDB hinter dem Interface `VectorStore`
(nur Suchindex). Befehle in der README.

Backend-Struktur (Module nach Domäne, Klassen-Stil):

```
backend/
├── prisma/schema.prisma        alle Modelle an einer Stelle
├── prisma.config.ts
├── src/
│   ├── modules/<domäne>/
│   │   ├── <domäne>.routes.ts      URL → Controller-Methode
│   │   ├── <domäne>.controller.ts  nur HTTP: Zod-Parsing, Statuscodes
│   │   ├── <domäne>.service.ts     Logik, kennt kein HTTP
│   │   ├── <domäne>.schemas.ts     Zod-Schemas + z.infer-Typen
│   │   └── <domäne>.module.ts      create<Domäne>Module(deps) → { router, service }
│   ├── prompts/                eine Datei pro Prompt-Unit, baut die vollständige Anfrage
│   ├── llm/                    clients.ts, send.ts, costs.ts; kein HTTP, keine Domäne
│   ├── shared/                 errors.ts, auth.middleware.ts, vector/ (ab Stufe 7)
│   ├── config/env.ts           Umgebungsvariablen mit Zod, Absturz beim Start bei Fehlern
│   ├── generated/prisma/       von Prisma erzeugt, nicht einchecken
│   ├── app.ts                  createApp(deps): Composition Root
│   └── server.ts               nur app.listen()
├── evals/                      außerhalb von src, importiert src/prompts; `pnpm evals <befehl>`
└── tests/                      spiegelt src/modules/<domäne>/
```

Regeln:

- Services und Controller sind Klassen mit Abhängigkeiten im Konstruktor (`private readonly`); kein
  Service erzeugt seine Abhängigkeiten selbst. Controller-Handler sind Arrow-Funktions-Properties.
- `app.ts` erzeugt Prisma, die Anthropic-Clients und alle Module genau einmal, in
  Abhängigkeitsreihenfolge, hängt die Router unter `/api/v1` ein; `errorHandler` kommt zuletzt.
- Domänen sprechen nur über Services miteinander. Jede Abfrage auf nutzereigene Daten filtert nach
  `userId`; ein fremder Datensatz verhält sich wie ein nicht existierender (404).
- Fehler: `ZodError` → 422, `NotFoundError` → 404, `UnauthorizedError` → 401 mit
  `WWW-Authenticate: Bearer`, alles andere → 500 ohne Details.
- `src/prompts/<unit>.ts` baut die vollständige Anfrage (System-Prompt, Modell, Effort, Tools bzw.
  Schema); Domänen-Service und Eval rufen dieselbe Funktion. Das JSON-Schema für Structured Outputs
  kommt per `z.toJSONSchema()` aus demselben Zod-Schema, das die Antwort validiert.
- Domänen (`auth`, `coach`, `cvs`, `jobs`, `matches`, `applications`, `interviews`, `documents`),
  Prompt-Units und der Chroma-Container entstehen erst in ihrer Stufe.

Kurz: einfach halten, dünne Dateien, keine Kommentare im Code.
