# job-match

job-match begleitet Bewerbende von der Stellenanzeige bis zur Zusage: Lebenslauf einmal
analysieren, passende Stellen und Match-Score sehen, Bewerbungen im Blick behalten, das
Vorstellungsgespräch schriftlich üben. Zugleich ein Lernprojekt für LLM-Anwendungen mit der
Claude API.

**Stand:** Neustart am 11.10.2026; seit dem 12.10.2026 wird das Backend mit Express und TypeScript
gebaut. Vorhanden sind das Fundament (Login, Logout, Health) und aus Stufe 1 der Chat mit dem Coach
(UC-02: gestreamte Antwort, Anhalten, erneut versuchen, Verlauf gespeichert); die App wird Stufe für
Stufe neu gebaut.

## Dokumentation

- [docs/APP_IDEA.md](docs/APP_IDEA.md) – App-Idee: Problem, Rollen, Domänenmodell, Use Cases je
  Stufe, Kernablauf, Claude-Themen.
- [docs/app-prompting-anchor.md](docs/app-prompting-anchor.md) – wie Prompts geschrieben werden.
  Verbindlich für jeden Prompt der App.
- [docs/app-evaluation-anchor.md](docs/app-evaluation-anchor.md) – wie bewertet wird. Verbindlich
  für jede Eval.
- [docs/EVAL_PLAN.md](docs/EVAL_PLAN.md) – Eval-Plan je Stufe: Prompt-Units, Beispiele, Prüfungen,
  Schwellen, Modellwahl.

## Vorhanden

| Datei                | Zweck                                                        |
| -------------------- | ------------------------------------------------------------ |
| `docker-compose.yml` | PostgreSQL 17 auf Host-Port 5433, legt `jobmatch_test` an    |
| `docker/initdb/`     | SQL beim ersten Start des DB-Containers                      |

```bash
docker compose up -d
```

## Stack

- **Backend** (`backend/`): Node.js 22, TypeScript (strict, ESM), Express 5, Zod 4, Prisma 7
  (`@prisma/adapter-pg`), Anthropic-SDK, argon2; Paketmanager **pnpm**; Tests mit Vitest + Supertest,
  Lint mit ESLint
- **Datenbank:** PostgreSQL 17 (Docker Compose, Host-Port 5433), einzige Quelle der Wahrheit;
  Vektorsuche ab Stufe 7 mit ChromaDB als reinem Suchindex
- **Frontend** (`frontend/`): Vue 3, Vite, TypeScript, Pinia, Vue Router, Tailwind CSS v4 (Theme in
  `src/assets/main.css`), Inter; Paketmanager **pnpm**; Tests mit Vitest

## Starten

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

Ein Dev-Volume aus der Zeit vor dem 12.10.2026 enthält noch die Tabellen der alten Migrationen: einmal
`pnpm prisma migrate reset` (oder `docker compose down -v`) ausführen, bevor `pnpm prisma migrate dev`
läuft.

## Prüfen

Backend: `pnpm typecheck`, `pnpm lint`, `pnpm test` (die Tests laufen gegen `jobmatch_test`).
Frontend: `pnpm test`, `pnpm build`.
Migrationen: `pnpm prisma migrate dev --name "..."` nach jeder Änderung an `prisma/schema.prisma`.
Evals (nie in CI): `pnpm evals <befehl> …`, siehe [docs/EVAL_PLAN.md](docs/EVAL_PLAN.md).
