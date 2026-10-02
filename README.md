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

**Neustart mit Express.** Die Dokumentation steht, als Nächstes wird Stufe 0 (Fundament) gebaut:
leeres Express-Backend mit Health-Route und Datenbank-Anbindung, Vue-Frontend mit Statusseite,
Migrationen, Tests und CI. Plan: [docs/STUFEN.md](docs/STUFEN.md).

## Dokumentation

- [docs/IDEE.md](docs/IDEE.md) – **Die App-Idee** ohne Technik: was man mit der App machen kann,
  Entscheidungen, fachliche Roadmap.
- [docs/STUFEN.md](docs/STUFEN.md) – **Stufenplan**: Reihenfolge, Aufgaben, Prompt-Units und
  Lernziele je Stufe.
- [docs/STACK.md](docs/STACK.md) – **Tech Stack, Struktur und Stil**. Verbindlich für neuen Code.
- [docs/app-prompting-anchor.md](docs/app-prompting-anchor.md) – **Wie Prompts geschrieben werden**
  (nach Berryman & Ziegler, _Prompt Engineering for LLMs_). Verbindlich für jeden Prompt der App.

## Tech Stack

- **Backend:** Node.js 24, Express 5, TypeScript, Zod, Drizzle ORM, Anthropic-SDK
- **Datenbank:** PostgreSQL 17 + pgvector (Docker Compose, Host-Port 5433)
- **Frontend:** Vue 3, Vite, TypeScript, Tailwind CSS v4, shadcn-vue, Pinia
- **Gemeinsam:** pnpm-Workspace; Zod-Schemas des API-Vertrags in `shared/`
- **Qualität:** ESLint, Prettier, `tsc`/`vue-tsc`, Vitest, supertest; GitHub Actions

Schnellstart, Befehle und Umgebungsvariablen kommen mit Stufe 0 hierher.

## Hinweise

- **Keine Secrets committen** – `.env` ist gitignored, neue Variablen gehören in `.env.example`,
  `backend/src/config.ts` und die Tabelle hier in der README.
- **Postgres-Port:** Compose published den Host-Port **5433** (Container-intern 5432), weil lokal
  häufig bereits ein Postgres auf 5432 läuft.
- **Kein Test ruft ein echtes Modell auf.** Nur `pnpm llm:check` und die Evals tun das – von Hand,
  und sie kosten Geld.
