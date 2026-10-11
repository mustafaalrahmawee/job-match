# job-match

job-match begleitet Bewerbende von der Stellenanzeige bis zur Zusage: Lebenslauf einmal
analysieren, passende Stellen und Match-Score sehen, Bewerbungen im Blick behalten, das
Vorstellungsgespräch schriftlich üben. Zugleich ein Lernprojekt für LLM-Anwendungen mit der
Claude API.

**Stand:** Neustart am 11.10.2026 mit FastAPI statt Express. Das Repo enthält nur das Fundament;
die App wird Stufe für Stufe neu gebaut.

## Dokumentation

- [docs/APP_IDEA.md](docs/APP_IDEA.md) – App-Idee: Problem, Rollen, Domänenmodell, Use Cases je
  Stufe, Kernablauf, Claude-Themen, Entscheidungen.
- [docs/app-prompting-anchor.md](docs/app-prompting-anchor.md) – wie Prompts geschrieben werden.
  Verbindlich für jeden Prompt der App.
- [docs/app-evaluation-anchor.md](docs/app-evaluation-anchor.md) – wie bewertet wird. Verbindlich
  für jede Eval.

## Vorhanden

| Datei                | Zweck                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `docker-compose.yml` | PostgreSQL 17 + pgvector auf Host-Port 5433, legt `jobmatch_test` an  |
| `docker/initdb/`     | SQL beim ersten Start des DB-Containers                               |
| `theme.css`          | Tailwind-Theme (Farben, Hintergrund, Dark Mode) für das neue Frontend |

```bash
docker compose up -d
```

## Geplanter Stack

- **Backend:** Python, FastAPI, Pydantic, Anthropic-SDK
- **Datenbank:** PostgreSQL 17 + pgvector (Docker Compose)
- **Frontend:** Vue 3, Vite, TypeScript, Tailwind CSS v4
