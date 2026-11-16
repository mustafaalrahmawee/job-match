# job-match

job-match begleitet Bewerbende von der Stellenanzeige bis zur Zusage: Lebenslauf einmal
analysieren, passende Stellen und Match-Score sehen, Bewerbungen im Blick behalten, den
Coach nach Interviewfragen fragen. Zugleich ein Lern- und Portfolio-Projekt für LLM-Anwendungen mit
der Claude API.

**Was das Projekt zeigt:** wie jeder Modellaufruf entworfen, abgesichert und gemessen wird –
Structured Outputs aus einem Zod-Schema, Modellwahl als Kosten-Trade-off, Kosten je Aufruf,
Prompt-Injection strukturell behandelt, ein Agent nur dort, wo ein Workflow nicht reicht. Einstieg
mit Prüfpfaden in den Code: [docs/ENGINEERING.md](docs/ENGINEERING.md).

**Stand:** Stufe 1 bis 4 sind fertig (UC-01 bis UC-11: Login, Coach-Chat, Lebenslauf, Stellen,
Match-Analyse, Bewerbungen, Coach mit lesendem Werkzeug und Firmenrecherche per Websuche), alle
Prompts sind neu geschrieben, und die Liste „Passt zu dir“ sucht passende Stellen per Vektorsuche
(UC-14).

**Als Nächstes,** in dieser Reihenfolge:

1. Eval für `cv_analysis`; sie kommt zuerst, weil die Suche den Text aus der gespeicherten
   Analyse einbettet.
2. Die Suche messen (UC-15: Prüfbestand, Recall@20, nDCG@20, MRR), danach Reranking (UC-16) oder
   hybride Suche über Skills (UC-17), je nachdem, was die Zahlen belegen.
3. Ein Werkzeug-Register (UC-20), aus dem der Coach die Stellensuche als lesendes Werkzeug bekommt
   (UC-22).
4. Eval für `coach_agent`, mit dem neuen Werkzeug.
5. Go-live mit Registrierung und Konto (UC-13).
6. Danach ein lesender MCP-Server mit eigenen Zugriffstoken (UC-21), eine Seite für Kosten und
   Fehlerquote der Modellaufrufe (UC-26) und ein Hinweis auf neue passende Stellen nach dem Import
   (UC-23).

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
