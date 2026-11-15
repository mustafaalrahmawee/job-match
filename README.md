# job-match

job-match begleitet Bewerbende von der Stellenanzeige bis zur Zusage: Lebenslauf einmal
analysieren, passende Stellen und Match-Score sehen, Bewerbungen im Blick behalten, das
Vorstellungsgespräch schriftlich üben. Zugleich ein Lernprojekt für LLM-Anwendungen mit der
Claude API.

**Was das Projekt zeigt:** wie jeder Modellaufruf entworfen, abgesichert und gemessen wird –
Structured Outputs aus einem Zod-Schema, Modellwahl als Kosten-Trade-off, Kosten je Aufruf,
Prompt-Injection strukturell behandelt, ein Agent nur dort, wo ein Workflow nicht reicht. Einstieg
mit Prüfpfaden in den Code: [docs/ENGINEERING.md](docs/ENGINEERING.md).

**Stand:** Stufe 1 bis 4 sind fertig (UC-01 bis UC-11: Login, Coach-Chat, Lebenslauf, Stellen,
Match-Analyse, Bewerbungen, Coach mit lesendem Werkzeug und Firmenrecherche per Websuche). Als
Nächstes werden alle Prompts neu geschrieben, danach kommen die Evals und der Go-live.

## Stack

- **Backend** (`backend/`): Node.js 22, TypeScript (strict, ESM), Express 5, Zod 4, Prisma 7
  (`@prisma/adapter-pg`), Anthropic-SDK, argon2; Paketmanager **pnpm**; Tests mit Vitest + Supertest,
  Lint mit ESLint
- **Datenbank:** PostgreSQL 17 (Docker Compose, Host-Port 5433), einzige Quelle der Wahrheit
- **Suche (UC-14):** ChromaDB 1.5.9 als Vektorspeicher (Dienst `chroma`, Host-Port 8001; für die Tests
  `chroma-test`, Host-Port 8002), Embeddings lokal mit Ollama 0.40.16 (Dienst `ollama`, Host-Port
  11434, Modell `jina-embeddings-v2-base-de`); alle Ports nur an `127.0.0.1`, PostgreSQL bleibt die
  Quelle der Wahrheit
- **Frontend** (`frontend/`): Vue 3, Vite, TypeScript, Pinia, Vue Router, Tailwind CSS v4 (Theme in
  `src/assets/main.css`), Inter; Paketmanager **pnpm**; Tests mit Vitest

## Starten

Datenbank, ChromaDB (`chroma`, `chroma-test`) und Ollama (`ollama`); die Datenbank legt beim ersten
Start auch die Testdatenbank `jobmatch_test` an, SQL in `docker/initdb/`:

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
Stellen-Pool füllen (Jobsuche der Bundesagentur, nur Deutschland, letzte 30 Tage; später täglich per Cron):
`pnpm import-jobs`; danach gleicht der Befehl die Suche mit ChromaDB ab.
Suche ohne Import abgleichen (fehlende Einträge einbetten, überzählige entfernen, voller Neulauf nach
einer neuen Generation): `pnpm sync-search`.

## Prüfen

Backend: `pnpm typecheck`, `pnpm lint`, `pnpm test` (die Tests laufen gegen `jobmatch_test` und
`chroma-test`, Ollama brauchen sie nicht).
Frontend: `pnpm test`, `pnpm build`.
Migrationen: `pnpm prisma migrate dev --name "..."` nach jeder Änderung an `prisma/schema.prisma`.
