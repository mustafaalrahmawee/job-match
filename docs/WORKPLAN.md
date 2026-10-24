# job-match – Arbeitsplan

Stand: 17. Oktober 2026

Alle Skill-Aufrufe in der Reihenfolge, in der sie dran sind. Jeder Aufruf kommt in den Chat von
Claude Code; bei `/review-loop` schreibt Claude Code, den Prüfer startet es selbst als Claude Code auf
z.ai (`glm-5.3`).
Was ein Use Case leistet, steht in [APP_IDEA.md](APP_IDEA.md); Modell und Effort je Prompt-Unit in
[EVAL_PLAN.md](EVAL_PLAN.md) §5.

Regel je Use Case mit Modellaufruf: erst `/prompt-unit <unit>`, dann `/review-loop UC-xx`. Ohne
Modellaufruf nur `/review-loop UC-xx`. Nach jedem fertigen Use Case: Änderungen ansehen, committen.

## Phase A · App bauen

### Erledigt

| Use Case | Befehle | Commit |
| --- | --- | --- |
| UC-01 Anmelden | – | Stufe 1 |
| UC-02 Coach-Chat | – | Stufe 1 |
| UC-03 Gespräche, Qualität, Effort | – | Stufe 1 |
| UC-04 Lebenslauf hochladen | – | `22b0aeb` |
| UC-05 Versionen | – | `7b2ee2c` |
| UC-06 Coach kennt den Lebenslauf | – | `022f7ad` |

### Stufe 3 · Stellen und Match

- [x] `/review-loop UC-07` – Import aus der Bundesagentur, kein Modell
- [x] `/prompt-unit job_extract`
- [x] `/review-loop UC-08` – eigene Stelle aus Text oder Screenshot
- [x] `/prompt-unit match_analysis`
- [x] `/review-loop UC-09` – Match-Analyse

### Stufe 4 · Bewerbungen und Coach-Aktionen

- [x] `/review-loop UC-10` – Bewerbungen mit Status, Verlauf, Notizen, kein Modell
- [x] `/prompt-unit coach_agent`
- [x] `/review-loop UC-11` – Coach schlägt im Chat nach (lesende Werkzeuge, Websuche); ersetzt `coach_chat`

### Stufe 5 · Interview-Training

- [x] `/prompt-unit interview_question`
- [ ] `/prompt-unit interview_grade`
- [ ] `/prompt-unit interview_report`
- [ ] `/review-loop UC-12` – Training mit Frage, Antwort, Note, Bericht

### Stufe 6 · Lange Gespräche

- [ ] `/review-loop UC-13` – Kontextverwaltung, Caching, Kosten im Log; keine neue Unit; Caching für den ganzen Coach in einem Entwurf, auch für die Runden eines Turns

### Stufe 7 · Anschreiben und Kalender

- [ ] `/prompt-unit cover_letter`
- [ ] `/review-loop UC-14` – Word-Datei und Kalendereintrag über MCP

### Go-live

- [ ] `/review-loop UC-15` – Registrieren, Passwort, Konto löschen, Datenexport, Nutzungslimit
- [ ] App online stellen

## Phase B · Messen

Erst wenn die App vollständig ist. Je Unit in dieser Reihenfolge; die Suite von `coach_agent` enthält auch die
Fälle ohne Werkzeug aus UC-02, UC-03 und UC-06 (EVAL_PLAN §4).

| Unit | Befehle |
| --- | --- |
| `cv_analysis` | `/eval-setup cv_analysis` · `/eval-samples cv_analysis 25` · `/eval-run cv_analysis v1` |
| `job_extract` | `/eval-setup job_extract` · `/eval-samples job_extract 15` · `/eval-run job_extract v1` |
| `match_analysis` | `/eval-setup match_analysis` · `/eval-samples match_analysis 30` · `/eval-run match_analysis v1` · erste Judge-Kalibrierung |
| `coach_agent` | `/eval-setup coach_agent` · `/eval-samples coach_agent 20` · `/eval-run coach_agent v1` |
| `interview_grade`, `interview_question`, `interview_report` | je `/eval-setup`, `/eval-samples`, `/eval-run`; dann `pnpm evals mock interview v1` |
| `coach_agent`, `interview_grade` lang | lange Verläufe unter `samples/long/`, `/eval-run` |
| `cover_letter` | `/eval-setup` · `/eval-samples … 10` · `/eval-run … v1` |

Bei jedem `/eval-run`: erst die Kostenschätzung lesen, dann zustimmen. Ein Modellwechsel nach einer
Messung ändert die Konstanten der Unit und die Zeile in EVAL_PLAN §5.
