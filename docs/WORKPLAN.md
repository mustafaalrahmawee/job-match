# job-match – Arbeitsplan

Stand: 17. Oktober 2026

Alle Skill-Aufrufe in der Reihenfolge, in der sie dran sind. Jeder Aufruf kommt in den Chat von
Claude Code; `/review-loop` läuft abwechselnd in Claude Code (Schreiber) und im z.ai-Tool (Prüfer).
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
| UC-06 Coach kennt den Lebenslauf | – | `e955682` |

### Stufe 3 · Stellen und Match

- [x] `/review-loop UC-07` – Import aus der Bundesagentur, kein Modell
- [ ] `/prompt-unit job_extract`
- [ ] `/review-loop UC-08` – eigene Stelle aus Text oder Screenshot
- [ ] `/prompt-unit match_analysis`
- [ ] `/review-loop UC-09` – Match-Analyse

### Stufe 4 · Bewerbungen und Coach-Aktionen

- [ ] `/review-loop UC-10` – Bewerbungen mit Status, Verlauf, Notizen, kein Modell
- [ ] `/prompt-unit coach_agent`
- [ ] `/review-loop UC-11` – Coach handelt im Chat (Tools, Websuche)

### Stufe 5 · Interview-Training

- [ ] `/prompt-unit interview_question`
- [ ] `/prompt-unit interview_grade`
- [ ] `/prompt-unit interview_report`
- [ ] `/review-loop UC-12` – Training mit Frage, Antwort, Note, Bericht

### Stufe 6 · Lange Gespräche

- [ ] `/review-loop UC-13` – Kontextverwaltung, Caching, Kosten im Log; keine neue Unit

### Stufe 7 · Die fünf besten Stellen

- [ ] `/prompt-unit job_recommendation`
- [ ] `/review-loop UC-14` – Vektorsuche und Begründungen

### Stufe 8 · Anschreiben und Kalender

- [ ] `/prompt-unit cover_letter`
- [ ] `/review-loop UC-15` – Word-Datei und Kalendereintrag über MCP

### Go-live

- [ ] `/review-loop UC-16` – Registrieren, Passwort, Konto löschen, Datenexport, Nutzungslimit
- [ ] App online stellen

## Phase B · Messen

Erst wenn die App vollständig ist. Je Unit in dieser Reihenfolge; `coach_chat` und `cv_analysis` haben
Suite und Läufe schon, dort fehlt nur der Judge.

| Unit | Befehle |
| --- | --- |
| `coach_chat` | `pnpm evals judge coach_chat <fassung>`, dann Tabelle in EVAL_PLAN §5 bestätigen oder ändern |
| `cv_analysis` | `pnpm evals judge cv_analysis <fassung>`, dann Tabelle bestätigen oder ändern |
| `job_extract` | `/eval-setup job_extract` · `/eval-samples job_extract 15` · `/eval-run job_extract v1` |
| `match_analysis` | `/eval-setup match_analysis` · `/eval-samples match_analysis 30` · `/eval-run match_analysis v1` · erste Judge-Kalibrierung |
| `coach_agent` | `/eval-setup coach_agent` · `/eval-samples coach_agent 20` · `/eval-run coach_agent v1` |
| `interview_grade`, `interview_question`, `interview_report` | je `/eval-setup`, `/eval-samples`, `/eval-run`; dann `pnpm evals mock interview v1` |
| `coach_chat`, `interview_grade` lang | lange Verläufe unter `samples/long/`, `/eval-run` |
| `job_recommendation` | `/eval-setup` · `/eval-samples … 20` · `/eval-run … v1` |
| `cover_letter` | `/eval-setup` · `/eval-samples … 10` · `/eval-run … v1` |

Bei jedem `/eval-run`: erst die Kostenschätzung lesen, dann zustimmen. Ein Modellwechsel nach einer
Messung ändert die Konstanten der Unit und die Zeile in EVAL_PLAN §5.
