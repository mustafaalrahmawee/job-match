# job-match

job-match begleitet Bewerbende von der Stellenanzeige bis zur Zusage: Lebenslauf einmal
analysieren, passende Stellen und Match-Score sehen, Bewerbungen im Blick behalten, das
Vorstellungsgespräch schriftlich üben. Zugleich ein Lernprojekt für LLM-Anwendungen mit der
Claude API.

**Stand:** Stufe 1 (UC-01 bis UC-03: Login, Chat mit dem Coach, Gespräche verwalten) und Stufe 2
(UC-04 bis UC-06: Lebenslauf) sind fertig, Stufe 3 (Stellen und Match) ist dran. Was je Stufe
entsteht, steht in [docs/APP_IDEA.md](docs/APP_IDEA.md); welcher Befehl als Nächstes kommt, in
[docs/WORKPLAN.md](docs/WORKPLAN.md).

**Reihenfolge:** Phase A baut erst alle Use Cases bis zum Go-live; Modell und Effort je Prompt-Unit
sind geschätzt und festgelegt ([docs/EVAL_PLAN.md](docs/EVAL_PLAN.md) §5). Phase B misst danach
Unit für Unit mit Evals und passt Modell, Effort und Prompt an. Die Evals für `coach_chat` und
`cv_analysis` aus Stufe 1 und 2 bleiben liegen, bis Phase B beginnt.

## Dokumentation

- [docs/APP_IDEA.md](docs/APP_IDEA.md) – App-Idee: Problem, Rollen, Domänenmodell, Use Cases je
  Stufe, Kernablauf, Claude-Themen.
- [docs/WORKPLAN.md](docs/WORKPLAN.md) – Arbeitsplan: alle Skill-Aufrufe in Reihenfolge, Phase A und B,
  mit Haken für Erledigtes.
- [docs/app-prompting-anchor.md](docs/app-prompting-anchor.md) – wie Prompts geschrieben werden.
  Verbindlich für jeden Prompt der App.
- [docs/app-evaluation-anchor.md](docs/app-evaluation-anchor.md) – wie bewertet wird. Verbindlich
  für jede Eval.
- [docs/EVAL_PLAN.md](docs/EVAL_PLAN.md) – Eval-Plan je Stufe: Prompt-Units, Beispiele, Prüfungen,
  Schwellen, Modellwahl.

## Stack

- **Backend** (`backend/`): Node.js 22, TypeScript (strict, ESM), Express 5, Zod 4, Prisma 7
  (`@prisma/adapter-pg`), Anthropic-SDK, argon2; Paketmanager **pnpm**; Tests mit Vitest + Supertest,
  Lint mit ESLint
- **Datenbank:** PostgreSQL 17 (Docker Compose, Host-Port 5433), einzige Quelle der Wahrheit;
  Vektorsuche ab Stufe 7 mit ChromaDB als reinem Suchindex
- **Frontend** (`frontend/`): Vue 3, Vite, TypeScript, Pinia, Vue Router, Tailwind CSS v4 (Theme in
  `src/assets/main.css`), Inter; Paketmanager **pnpm**; Tests mit Vitest

## Starten

Datenbank (legt beim ersten Start auch die Testdatenbank `jobmatch_test` an, SQL in `docker/initdb/`):

```bash
docker compose up -d
```

```bash
cd backend && cp -n .env.example .env && pnpm install && pnpm prisma migrate dev && pnpm dev
```

```bash
cd frontend && pnpm install && pnpm dev
```

Der Backend-Dev-Server läuft auf Port 8000; Vite leitet `/api` dorthin weiter.
Konto anlegen (bis zum Go-live gibt es keine Registrierung): `pnpm create-user <email>`.

## Prüfen

Backend: `pnpm typecheck`, `pnpm lint`, `pnpm test` (die Tests laufen gegen `jobmatch_test`).
Frontend: `pnpm test`, `pnpm build`.
Migrationen: `pnpm prisma migrate dev --name "..."` nach jeder Änderung an `prisma/schema.prisma`.
Evals (nie in CI, erst in Phase B): `pnpm evals <befehl> …`, siehe [docs/EVAL_PLAN.md](docs/EVAL_PLAN.md).

## Skills (Claude Code)

Wiederkehrende Abläufe liegen als Skills in `.claude/skills/`; Aufruf im Chat mit `/<name>`. Welcher
Aufruf wann dran ist, steht in [docs/WORKPLAN.md](docs/WORKPLAN.md).

- `/eval-setup <unit>` – baut die Eval-Grundlage einer Prompt-Unit aus ihrem Abschnitt im Eval-Plan:
  `review.md`, Korpus-Ordner falls nötig, die Unit in `pnpm evals review`, `run` und `check`, Tests.
- `/eval-samples <unit> <anzahl>` – schreibt Beispielfälle einer Eval-Unit mit dem Subagenten
  `sample-writer` (`.claude/agents/`) und lässt glm-5.3 sie mit `pnpm evals review` prüfen, höchstens
  drei Runden.
- `/eval-run <unit> <fassung> [modell] [effort]` – schätzt die Kosten, startet nach Zustimmung den
  Batch und bewertet mit `pnpm evals check`.
- `/prompt-unit <unit>` – schreibt eine Prompt-Unit in `backend/src/prompts/` nach
  `docs/app-prompting-anchor.md`: der Subagent `prompt-writer` (Opus 5.5) schreibt, `prompt-reviewer`
  (Fable 5.1) prüft gegen den Anker, höchstens zwei Runden. Läuft vor `/review-loop` des Use Case.
- `/review-loop UC-xx` – baut einen Use Case mit zwei Agenten (Schreiber und Prüfer), die nur über
  Dateien in `.review/` sprechen; `/review-loop` setzt fort, `/review-loop reset` beginnt neu. Über
  `.zcode/skills/` auch im z.ai-Tool verfügbar, damit der Prüfer dort laufen kann.
