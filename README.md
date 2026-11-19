# job-match

job-match begleitet Bewerbende von der Stellenanzeige bis zur Zusage: Lebenslauf einmal
analysieren, passende Stellen und Match-Score sehen, Bewerbungen im Blick behalten, den
Coach nach Interviewfragen fragen. Zugleich ein Lern- und Portfolio-Projekt für LLM-Anwendungen mit
der Claude API.

**Was das Projekt zeigt:** wie jeder Modellaufruf entworfen, abgesichert und gemessen wird –
Structured Outputs aus einem Zod-Schema, Modellwahl als Kosten-Trade-off, Kosten je Aufruf,
Prompt-Injection strukturell behandelt, ein Agent nur dort, wo ein Workflow nicht reicht. Einstieg
mit Prüfpfaden in den Code: [docs/ENGINEERING.md](docs/ENGINEERING.md).

**Stand: abgeschlossen.** Gebaut sind UC-01 bis UC-11 und UC-14: Login, Coach-Chat, Lebenslauf,
Stellen, Match-Analyse, Bewerbungen, Coach mit lesendem Werkzeug, Firmenrecherche per Websuche und
die Liste „Passt zu dir“ per Vektorsuche. Alle Prompts sind nach dem Prompt-Leitfaden neu
geschrieben. Weitere Use Cases sind nicht geplant.

**Grenzen:** Gemessen ist nur `cv_analysis`, in vier Runden mit 20 Fällen (Prompt, Effort,
Modell; Ergebnis in [docs/ENGINEERING.md](docs/ENGINEERING.md#die-eval-von-cv_analysis)). Für die
übrigen Prompt-Units sind Modell und Effort begründete Schätzungen; geprüft wird von Hand im
Browser. Die Güte der Suche ist nicht gemessen. Es gibt keine Registrierung; Konten entstehen per
Skript.

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

Einmalig (und nach jeder Änderung an den Paketen) auf dem Host installieren; die Container nutzen
diese `node_modules`:

```bash
cd backend && cp -n .env.example .env && pnpm install && pnpm prisma migrate dev
```

```bash
cd frontend && pnpm install
```

Datenbank, ChromaDB (`chroma`, `chroma-test`), Ollama (`ollama`), Backend (`backend`) und Frontend
(`frontend`); die Datenbank legt beim ersten Start auch die Testdatenbank `jobmatch_test` an, SQL in
`docker/initdb/`:

```bash
docker compose up -d
```

Backend und Frontend laufen im Netz des Hosts (`network_mode: host`), damit `backend/.env` mit
`127.0.0.1` unverändert gilt; beide laden Änderungen am Code neu. Der Backend-Dev-Server läuft auf
Port 8000, das Frontend auf http://localhost:5173; Vite leitet `/api` dorthin weiter.
Logs: `docker compose logs -f backend frontend`.
Konto anlegen (es gibt keine Registrierung): `pnpm create-user <email>`.
Stellen-Pool füllen (Jobsuche der Bundesagentur, nur Deutschland, letzte 30 Tage):
`pnpm import-jobs`; danach gleicht der Befehl die Suche mit ChromaDB ab.
Suche ohne Import abgleichen (fehlende Einträge einbetten, überzählige entfernen, voller Neulauf nach
einer neuen Generation): `pnpm sync-search`.

## Prüfen

Backend: `pnpm typecheck`, `pnpm lint`, `pnpm test` (die Tests laufen gegen `jobmatch_test` und
`chroma-test`, Ollama brauchen sie nicht).
Frontend: `pnpm test`, `pnpm build`.
Migrationen: `pnpm prisma migrate dev --name "..."` nach jeder Änderung an `prisma/schema.prisma`.
