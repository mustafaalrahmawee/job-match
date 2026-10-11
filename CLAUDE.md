# job-match

Neustart (11.10.2026): Die App wird von null mit **FastAPI** (Backend) und **Vue 3 + Tailwind**
(Frontend) gebaut, Stufe für Stufe. Fachliche Idee, Domänenmodell, Use Cases je Stufe und
Entscheidungen: [docs/APP_IDEA.md](docs/APP_IDEA.md). Nur die aktuelle Stufe umsetzen.

Jeder Prompt folgt [docs/app-prompting-anchor.md](docs/app-prompting-anchor.md), jede Eval
[docs/app-evaluation-anchor.md](docs/app-evaluation-anchor.md).

Vorhanden: `docker-compose.yml` (PostgreSQL 17 + pgvector, Host-Port 5433) und `theme.css`
(Tailwind-Farben, Hintergrund, Dark Mode) – beim Anlegen des Frontends als
`frontend/src/assets/main.css` übernehmen.

Kurz: einfach halten, dünne Dateien, keine Kommentare im Code.
