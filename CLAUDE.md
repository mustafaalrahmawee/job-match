# job-match

Die App wird Stufe für Stufe mit **Express + TypeScript** (Backend) und **Vue 3 + Tailwind**
(Frontend) gebaut. Fachliche Idee, Domänenmodell, Use Cases je Stufe:
[docs/APP_IDEA.md](docs/APP_IDEA.md). Nur die aktuelle Stufe umsetzen.

Jeder Prompt folgt [docs/app-prompting-anchor.md](docs/app-prompting-anchor.md), jede Eval
[docs/app-evaluation-anchor.md](docs/app-evaluation-anchor.md); was je Stufe geprüft wird, steht in
[docs/EVAL_PLAN.md](docs/EVAL_PLAN.md).

Stack, Datenbank und Befehle stehen in der [README](README.md).

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
│   ├── shared/                 errors.ts, auth.middleware.ts
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
- Domänen (`auth`, `coach`, `cvs`, `jobs`, `matches`, `applications`, `interviews`, `documents`)
  und Prompt-Units entstehen erst in ihrer Stufe.

Kurz: einfach halten, dünne Dateien, keine Kommentare im Code.
