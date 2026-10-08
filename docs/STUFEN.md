# Stufenplan

Dieses Dokument legt fest, **in welcher Reihenfolge** job-match gebaut wird und was jede Stufe
technisch umfasst. Was die App fachlich kann, steht in [IDEE.md](IDEE.md); wie Code aussieht, in
[STACK.md](STACK.md); wie Prompts geschrieben werden, in
[app-prompting-anchor.md](app-prompting-anchor.md); wie bewertet wird, in [EVAL.md](EVAL.md) nach
[app-evaluation-anchor.md](app-evaluation-anchor.md).

Legende: `[x]` erledigt · `[ ]` offen

---

## 1. Grundregeln

- **Eine Stufe nach der anderen.** Jede Stufe ist lauffähig, getestet und committet, bevor die
  nächste beginnt. Was erst später dran ist, wird vorher nicht eingebaut.
- **Jede Stufe führt ein Claude-Thema ein** und hält fest, was dabei gelernt wurde (Abschnitt
  „Lernziele“). Ein Lernziel gilt erst als erreicht, wenn es sich in eigenen Worten erklären und im
  Code zeigen lässt.
- **Jede KI-Funktion ist eine Prompt-Unit** mit Steckbrief (Form, Archetyp, Surface, Slots, Stopp,
  was der Code erzwingt) und bekommt mit dem ersten Prompt eine Example Suite nach ihrem
  Evaluation-Sheet in [EVAL.md](EVAL.md).
- **Claude ist das Ziel, das Modell wählt jede Prompt-Unit selbst.** Standard ist **Claude Haiku
  5.5**; sobald die Example Suite einer Unit steht, wird gemessen, ob Sonnet 5.5 oder ein anderer
  Effort nötig ist, und die billigste Variante über der Grenze gewählt (EVAL.md §5). App und Eval
  nutzen dasselbe Modell. Opus 5.5 kommt nicht in die App. glm-5.3 (`high`) über z.ai ist Judge
  der Evals und Modell der Integrationstests; synthetische Beispiele erzeugt Claude Code im Abo.
- **Schwerpunkt KI im Produkt:** Structured Outputs, Tool Use mit eigener Agent-Schleife und
  Abbruchbedingungen, Evals, Kosten und Tokens messen, Prompt Injection abwehren. Alles andere bleibt
  so einfach wie möglich (STACK.md, Leitlinie).
- **Kosten sichtbar machen:** Jede Modellanfrage protokolliert Modell, Effort, Tokens und Dauer.

**Fertig heißt bei jeder Stufe:** Punkte abgehakt, `pnpm lint`/`format:check`/`typecheck`/`test`
grün, CI grün, README aktualisiert, Lernziele abgehakt.

---

## 2. Überblick

| Stufe   | Fachlich (siehe IDEE.md)                                | Claude-Thema                                         |
| ------- | ------------------------------------------------------- | ---------------------------------------------------- |
| 0       | Fundament: leeres Backend + Frontend, DB, CI            | Client, Konfiguration, Fehlerklassen                 |
| 1       | Konto + Coach-Chat                                      | Messages API, Streaming, System-Prompt, Stopp-Gründe |
| 1b      | Stellen der Bundesagentur importieren (ohne KI)         | – (Datenbasis für Stufe 2, 3 und 7)                  |
| 2       | Lebenslauf-PDF, einmalige Analyse, Rolle, Fassungen     | PDF-Eingabe, Structured Outputs, Effort/Thinking     |
| 3       | Stellen (Text/Screenshot) + Match-Analyse               | Vision, Structured Outputs, Evals mit Kriterien      |
| 4       | Bewerbungen, Notizen, Coach handelt im Chat             | Tool Use, Server-Tool Websuche                       |
| 5       | Interview-Training (schriftlich)                        | Workflow vs. Agent, Tool Runner                      |
| 6       | Lange Trainings/Chats, fortsetzen, günstiger            | Prompt Caching, Compaction, Token-Zählung            |
| 7       | Stellen-Pool (Deutschland), „Top 5 Jobs“                | RAG mit pgvector, Message Batches                    |
| 8       | Anschreiben als Word-Datei, Termine im Kalender         | Agent Skills, Files API, MCP                         |
| Go-live | öffentlich: Registrierung, Konto löschen, Export, Limit | – (Produkt und Datenschutz)                          |

Go-live kann nach jeder Stufe ab 2 kommen; es muss nur **vor** der Öffnung fertig sein.

---

## Stufe 0 – Fundament

**Ziel:** Ein leeres, sauberes Gerüst, in das jede weitere Stufe nur noch Domänen einhängt. Kein
Fachcode.

**Repo**

- [x] pnpm-Workspace im Wurzelordner (`backend`, `frontend`, `shared`), ein Lockfile; Node 24
- [x] Gemeinsame ESLint- und Prettier-Konfiguration; `pnpm lint`, `format:check`, `typecheck`,
      `test` laufen über alle Pakete
- [x] `.env.example`, `.gitignore` für Node, README mit Schnellstart; `docker-compose.yml` behalten
- [x] GitHub Actions: Backend (Lint, Typen, Migrationen, Tests mit Postgres-Service) und Frontend

**Shared**

- [x] Paket `shared/` mit Zod; Schemas von Backend und Frontend importiert

**Backend**

- [x] `backend/` mit Express 5, TypeScript strict, `tsx` (`pnpm dev` mit Neustart bei Änderungen)
- [x] `config.ts`: Konfiguration aus `.env` (DB-URL, API-Key, Base-URL, Log-Level, Timeouts) mit Zod
      beim Start geprüft; Platzhalter-Key wird abgelehnt
- [x] `db.ts` + Drizzle eingerichtet; erste Migration aktiviert `pgvector`
- [x] `createApp(deps)` mit `GET /api/health` (nur „Server läuft“) und zentraler
      Fehler-Middleware
- [x] `llm/`: Client-Fabrik (Anthropic-SDK mit Base-URL, Timeout, Retries) und Modell-Zuordnung je
      Anbieter
- [x] Logging mit `pino` ohne Inhalte; Vitest + supertest eingerichtet und grün

**Frontend**

- [x] `frontend/` mit Vite, Vue 3, TypeScript strict, Tailwind v4, shadcn-vue, Pinia, Vue Router
- [x] Vite-Proxy `/api` → Backend
- [x] ESLint, Prettier, Vitest, `vue-tsc` grün

**Lernziele**

- [ ] pnpm-Workspace: Pakete, gemeinsames Lockfile, `--filter`, ein Paket importiert ein anderes
- [ ] Express 5: App-Fabrik, Router, Middleware, Fehler-Middleware, `async`-Handler
- [ ] Zod: Schema einmal schreiben, für Konfiguration, Request und Frontend-Typen nutzen
- [ ] Drizzle + drizzle-kit: Tabellen, Verbindung, Migration erzeugen und anwenden
- [ ] Anthropic-SDK: Client, Base-URL, Timeout, Retries, Fehlerklassen
- [ ] Warum Tests nie das echte Modell aufrufen – und wie man Modell-Abläufe stattdessen prüft

---

## Stufe 1 – Konto + Coach-Chat

**Ziel:** Anmelden und mit dem Coach chatten; Antworten erscheinen live, Gespräche bleiben
gespeichert. Konten legt bis zum Go-live nur das Skript `pnpm user:create` an.

**Konto**

- [x] Tabellen `users`, `auth_tokens`; Anmelden, Abmelden, `me`
- [x] Opake Tokens (256 Bit, nur SHA-256 in der DB, Ablaufdatum), `scrypt` für Passwörter
- [x] Gleiche Antwort bei unbekannter E-Mail und falschem Passwort; Rate-Limit für den Login
- [x] `pnpm user:create <email>`: Konto anlegen oder Passwort neu setzen (keine Registrierung in der App)

**Coach-Chat**

- [x] Tabellen `conversations`, `messages` (Inhalt als JSON-Inhaltsblöcke, nicht nur Text – nötig
      für Tools und Compaction später)
- [x] `POST /api/chat` als Server-Sent Events: `conversation`, `delta`, `done`, `refusal`, `error`
- [x] Verlauf aus der DB; Nutzernachricht vor, Antwort nach dem Aufruf speichern (auch Teilantwort
      bei Abbruch, nie eine leere); Abbruch, wenn der Browser die Verbindung trennt
- [x] Gespräche auflisten, laden, umbenennen, löschen (nur eigene, sonst 404)
- [x] Stopp-Gründe auswerten: `max_tokens`, `refusal` (Teilantwort verwerfen), leere Antwort
- [x] Modell- und Effort-Wahl (Normal/Erweitert, Niedrig/Hoch), Effort immer explizit senden

**Prompt-Unit `coach_chat`**

| Form            | Archetyp            | Surface          | Slots                                   | Stopp        | Code erzwingt                       |
| --------------- | ------------------- | ---------------- | --------------------------------------- | ------------ | ----------------------------------- |
| multi-turn chat | advice conversation | Markdown im Chat | Verlauf (indirekt, begrenzt), Nachricht | eine Antwort | Markdown bereinigen, Verlaufsgrenze |

- [x] Prompt nach Anchor §7 (Frame, Regeln mit Begründung, Scope-Satz)
- [x] Effort wird immer ausdrücklich gesendet (die Standardstufe ist je Modell verschieden);
      `thinking` bleibt ungesetzt, weil adaptives Thinking bei den Zielmodellen Standard ist
- [ ] Example Suite `coach_chat` – alte Suite am 08.10. entfernt, neu in Stufe 2 Kapitel 7 (EVAL.md 6.2)

**Frontend**

- [x] Login, Chat-Seite mit Seitenleiste, Streaming, Stopp, „Erneut versuchen“, Kopieren
- [x] Markdown sicher rendern; Hinweis bei gekürzter Antwort

**Lernziele**

- [ ] Messages API: zustandslos, Rollen, `system`, `max_tokens`, `stop_reason`
- [ ] Streaming mit dem SDK und als SSE an den Browser; Abbruch per Signal
- [ ] Effort und adaptives Thinking: was sie kosten, wie man sie steuert
- [ ] Tokenverbrauch loggen und Kosten abschätzen
- [ ] Sicherheit: Hash statt Klartext, Nutzer-Enumeration, Ownership-Check, 404 statt 403

---

## Stufe 1b – Stellen importieren (vorgezogen)

Vorgezogener Teil von Stufe 7, ohne Embeddings und ohne KI: echte Stellen liegen lokal in der DB,
bevor Lebenslauf und Match gebaut werden.
Ablauf, API-Eigenheiten, Probleme und Lösungen: [STELLEN-IMPORT.md](STELLEN-IMPORT.md).

- [x] Quelle: Jobsuche der Bundesagentur (kostenlos, inoffiziell dokumentiert auf bund.dev; fester
      Schlüssel `jobboerse-jobsuche`); Suche `/pc/v6/jobs`, Volltext `/pc/v4/jobdetails/{base64}`
- [x] Domäne `jobs`: Tabelle `jobs` mit eigenen, bereinigten Spalten und der Originalantwort `raw`;
      eindeutig je Quelle und Referenznummer
- [x] Umwandeln: fehlende Angaben bleiben `null` (unbekannt), Gehalt in Euro pro Jahr, erster Ort,
      Vermittler und Zeitarbeit werden markiert (`agency`), nicht aussortiert
- [x] Stellenart als Spalte `offerType` (Arbeit, Ausbildung, Praktikum, Selbstständigkeit), damit
      Jobsuchende Ausbildungsplätze herausfiltern können
- [x] Nur Stellen der letzten 30 Tage (Erstveröffentlichung, im Code geprüft – der Filter der API
      allein lässt ältere durch); bekannte Stellen werden übersprungen, ohne Details neu zu laden
- [x] `pnpm jobs:import <anzahl> ["<was>"] ["<wo>"]`; ohne Ort gleich viele Stellen je Bundesland,
      die Seiten über die erreichbaren 10.000 Treffer je Suche verteilt (die API sortiert nur nach
      Aktualität und kennt keinen Datumsbereich); Tests mit 20 echten Beispielstellen
      (`backend/test/fixtures/`) statt echter Aufrufe
- [x] Saubere Daten per Regel: gleiche Firma mit gleichem Text wird nur einmal gespeichert (fängt
      Dubletten und Platzhaltertexte unter vielen Titeln); Gehalt bei reiner Teilzeit oder außerhalb
      15.000–250.000 €/Jahr bleibt unbekannt

---

## Stufe 2 – Lebenslauf und Profil

**Ziel:** Lebenslauf als PDF hochladen, einmal analysieren, Ergebnis speichern; die Rolle bestätigen;
neue Fassungen ersetzen die alte; der Coach kennt die aktive Fassung.

**Schritt 1 – Fassungen ohne KI**

- [x] Domäne `profile`: Tabelle `cv_versions` (PDF als `bytea`, Rolle, aktiv/archiviert); die
      Datenbank erlaubt nur eine aktive Fassung je Nutzer (eindeutiger Teil-Index)
- [x] PDF-Upload (höchstens 5 MB, nur PDF); Dateiname kommt URL-kodiert im Header `X-File-Name` und wird im Log geschwärzt, Original bleibt gespeichert und abrufbar
- [x] Rolle von Hand aus einer festen Liste (12 IT-Rollen in `shared/src/profile.ts`)
- [x] Neue Fassung macht die alte inaktiv; alte Fassung reaktivieren ohne neues Hochladen
- [x] Seite „Mein Lebenslauf“: aktive Fassung, Rolle, PDF ansehen, Archiv
- [x] Eine oder mehrere Fassungen löschen (`POST /api/cvs/delete`, alles oder nichts); danach ist
      ggf. keine Fassung aktiv

**Schritt 2 – Analyse mit KI**

- [ ] Analyse **einmal** pro Fassung; Ergebnis als geprüftes Schema gespeichert
- [ ] Rollen-Vorschlag aus der festen Liste; Bestätigen oder andere wählen
- [ ] Reaktivieren nutzt die gespeicherte Analyse (keine neue Analyse)
- [ ] Coach-Chat bekommt die Analyse der aktiven Fassung als Kontext (nicht das PDF)
- [ ] Lebensläufe auf Deutsch und Englisch

**Prompt-Unit `cv_analysis`**

| Form                    | Archetyp            | Surface                               | Slots                                                                                | Stopp                      | Code erzwingt                                                                                             |
| ----------------------- | ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| single call (als Batch) | structured document | JSON nach Schema (Structured Outputs) | System (statisch, 1 h gecacht), PDF als `document` (direkt; gecacht nur in der Eval) | Schema erfüllt, `end_turn` | Zod, Rolle aus Liste, Listen gekürzt, `isCv`, Status nur einmal `running`, nie bei `max_tokens` speichern |

Bis zur Modellwahl in Kapitel 6 Claude Haiku 5.5 mit Effort `low` und Structured Outputs
(`output_config.format` aus dem Zod-Schema, kein Tool). Batches und Prompt Caching sind für diese Unit aus Stufe 6/7 vorgezogen –
ausschließlich, um Kosten zu senken. Gebaut Kapitel für Kapitel, je ein Konzept:

- [x] 1 – Structured Outputs statt Tool, ein Aufruf von Hand (Skript `cv:try` später entfernt)
- [x] 2 – Ergebnis prüfen und speichern, Randfälle (max_tokens, Ablehnung, kein Lebenslauf …)
- [x] 3 – Message Batches: Analyse als Batch, Ergebnis abholen, Ergebnis-Typen
- [x] 4 – Prompt Caching: System immer, PDF nur in der Eval, `ttl: '1h'`; gemessen: gemeinsamer Teil 2.579 Tokens
- [x] 5 – Frontend: „Wird analysiert …“, Analyse anzeigen, Rolle bestätigen
- [ ] 6 – Evaluation nach [EVAL.md](EVAL.md) 6.1: 18 Lebensläufe × 3 Läufe; Gold Standard (`isCv`,
      Rolle, Arbeitgeber), Functional Tests, SOMA-Judge glm-5.3 `high`; Modellwahl (EVAL.md §5):
      Sonnet `low`, Haiku `low`/`medium`/`high`, billigste Variante über der Grenze; dafür im Code
      Effort `medium` und Sonnet-Preise ergänzen
- [ ] 7 – Coach-Chat bekommt die Analyse als Kontext; Example Suite `coach_chat` neu (EVAL.md 6.2);
      vorher Judge kalibrieren (EVAL.md §4), dann Modellwahl für Normal/Erweitert

**Lernziele**

- [ ] PDF als `document`-Block; Grenzen (Seiten, Größe)
- [ ] Structured Outputs mit Zod (`messages.parse`): garantiert vs. nur erbeten
- [ ] Warum „einmal analysieren und speichern“ billiger ist als das PDF bei jeder Nachricht
- [ ] Wann man mehr Effort braucht – an der Example Suite gemessen
- [ ] Message Batches: asynchron, 50 % billiger, Ergebnis-Typen (`succeeded`, `errored`, `expired`)
- [ ] Prompt Caching: Präfix-Treffer, Schreiben vs. Lesen, TTL 5 Min. vs. 1 Std., Mindestlänge

---

## Stufe 3 – Stellen und Match-Analyse

**Ziel:** Eigene Stellen speichern (Text oder Screenshot) und sehen, wie gut die aktive Fassung passt.

- [ ] Domäne `jobs` (aus Stufe 1b) erweitern: Stelle von Hand anlegen, Sprache
- [ ] Screenshot einer Anzeige → Text (Vision)
- [ ] Domäne `matching`: Score 0–100, Stärken, Lücken, Tipps (zweigeteilt, falls bestätigt);
      gespeichert, nicht jedes Mal neu berechnet; bei Fassungswechsel ins Archiv; Fremdschlüssel
      auf `cv_versions` mit `onDelete: 'cascade'`, damit Löschen der Fassung die Ergebnisse mitnimmt
- [ ] Anzeigentext geht als markierter Block in den Prompt (fremder Text = Daten)
- [ ] Nachfragen zum Ergebnis im Coach-Chat

**Prompt-Units**

| Unit             | Form        | Archetyp            | Surface        | Stopp          | Code erzwingt                  |
| ---------------- | ----------- | ------------------- | -------------- | -------------- | ------------------------------ |
| `job_extraction` | single call | structured document | Zod-Objekt     | Schema erfüllt | Schema, Pflichtfelder          |
| `match_analysis` | single call | structured document | Ergebnis-Karte | Schema erfüllt | Score 0–100, Bezug auf Angaben |

- [ ] Evaluation nach [EVAL.md](EVAL.md) 6.3 und 6.4: `job_extraction` gegen die importierten
      Stellen (Gold Standard), `match_analysis` mit Score-Band je Fall; Modellwahl je Unit (EVAL.md §5)

**Lernziele**

- [ ] Vision: Bild als Content-Block, Formate und Grenzen
- [ ] Eval mit Kriterien: Gold-Fälle, Score-Bereiche, Vergleich zweier Prompt-Versionen
- [ ] Prompt Injection: warum Anzeigentext nie Anweisung sein darf, und was der Code prüft

---

## Stufe 4 – Bewerbungen und Coach-Tools

**Ziel:** Bewerbungen mit Status, Verlauf und Notizen führen; der Coach kann im Chat handeln.

- [ ] Domäne `applications`: Bewerbung, Statusverlauf mit Datum, Notizen mit Datum; ein Verweis
      auf die Fassung bekommt `onDelete: 'set null'` (Bewerbung bleibt, wenn die Fassung gelöscht wird)
- [ ] Seite „Bewerbungen“: Liste, Status ändern, Notizen; bleiben bei Rollenwechsel sichtbar
- [ ] Tools für den Coach: Stelle speichern, Status setzen, Interviewfragen erzeugen
- [ ] Server-Tool Websuche: Infos zur Firma
- [ ] Tool-Schleife im Chat; SSE-Events zeigen, was der Coach gerade tut
- [ ] Werte, die die App kennt (Nutzer, aktive Fassung), füllt der Code – nicht das Modell
- [ ] Evaluation nach [EVAL.md](EVAL.md) 6.5: Canned Conversations mit erwartetem Tool-Aufruf;
      Modellwahl (EVAL.md §5)

**Lernziele**

- [ ] Tool-Definition, `strict`, `tool_use` → Ausführen → `tool_result`, `is_error`
- [ ] Parallele Tool-Aufrufe; Client- vs. Server-Tools
- [ ] „Der Prompt lenkt, die App erzwingt“: welche Aktionen der Code absichert

---

## Stufe 5 – Interview-Training

**Ziel:** Schriftliches Training zu einer Stelle: Frage, Antwort, Bewertung, Abschlussbericht;
abbrechen und fortsetzen.

- [ ] **Vorab entscheiden und begründen:** fester Ablauf (Workflow) oder Agent mit Tools (Anchor
      AP-50/AP-55) – die Entscheidung wird hier festgehalten
- [ ] Domäne `interviews`: Sitzung, Fragen, Antworten, Bewertungen, Bericht
- [ ] Einstellungen: Anzahl Fragen, Schwierigkeit (✚ Fragenart, ✚ Fokus auf Lücken – falls bestätigt)
- [ ] Bewertung je Antwort sichtbar; Abschlussbericht; Rundenlimit und Stopp im Code
- [ ] Evaluation nach [EVAL.md](EVAL.md) 6.6: Antworten unterschiedlicher Qualität, User Mock;
      Modellwahl je Pass (EVAL.md §5)

**Lernziele**

- [ ] Wann ein Agent sich lohnt und wann ein Workflow reicht
- [ ] Tool Runner des SDK vs. eigene Schleife; „finish tool“ und Abbruchbedingungen

---

## Stufe 6 – Lange Sitzungen und Kosten

**Ziel:** Lange Trainings und Chats ohne Kontextüberlauf, günstiger durch Caching.

> Prompt Caching wird gemeinsam gebaut, nachdem die Doku gelesen ist.

- [ ] Prompt Caching: System-Prompt + Lebenslauf-Analyse als stabiler Präfix
- [ ] Ersparnis messen und dokumentieren (`cache_read_input_tokens`, vorher/nachher)
- [ ] Compaction für sehr lange Sitzungen (vollständige Inhaltsblöcke speichern)
- [ ] Tokens vor dem Senden zählen, wo es Entscheidungen beeinflusst

**Lernziele**

- [ ] Cache als Präfix-Treffer; stille Cache-Killer; Kosten Schreiben vs. Lesen
- [ ] Compaction vs. Context Editing

---

## Stufe 7 – Stellen-Pool und Empfehlungen

**Ziel:** Stellen aus Deutschland regelmäßig importieren; „Finde die 5 besten Jobs für mich“.

- [ ] Externe Jobbörsen-API auswählen (Deutschland, Nutzungsbedingungen prüfen)
- [ ] Regelmäßiger Import-Lauf (Hintergrund-Job), Duplikate und abgelaufene Stellen erkennen
- [ ] Embeddings (Anbieter wählen – Anthropic bietet keine), pgvector-Index, Filter nach Rolle
- [ ] „Top 5“: Vektorsuche → Modell begründet die Auswahl mit Verweis auf die Stellen-ID
- [ ] Viele Matches auf einmal über Message Batches (günstiger, asynchron)
- [ ] Evaluation nach [EVAL.md](EVAL.md) 6.7: erwartete Treffer unter den Top 5; Modellwahl
      (EVAL.md §5)

**Lernziele**

- [ ] RAG: suchen → auswählen → in den Prompt → begründete Antwort
- [ ] Embeddings, Kosinus-Ähnlichkeit, HNSW-Index, Chunking
- [ ] Message Batches: wann sie sich lohnen

---

## Stufe 8 – Unterlagen und Termine

**Ziel:** Anschreiben als Word-Datei; Interviewtermine im Kalender.

- [ ] Anschreiben passend zu Stelle und aktiver Fassung, als `.docx` per Agent Skill
- [ ] Evaluation nach [EVAL.md](EVAL.md) 6.8: Functional Tests der Datei, SOMA-Judge; Modellwahl
      (EVAL.md §5)
- [ ] Datei über die Files API herunterladen und der Bewerbung zuordnen
- [ ] Kalender per MCP: Termine eintragen und anzeigen; Zugangsdaten nur im Backend

**Lernziele**

- [ ] Agent Skills und Code Execution; Files API
- [ ] MCP-Connector; Rechte und Sicherheit

---

## Go-live – vor der Öffnung

- [ ] Registrierung öffnen; ✚ E-Mail bestätigen; ✚ Passwort vergessen
- [ ] Passwort ändern; **Konto löschen** (alle Daten); **Daten herunterladen**
- [ ] **Nutzungslimit** pro Konto (kostenlos mit Limit), ✚ Anzeige des Restlimits
- [ ] Datenschutzerklärung und Impressum; Logs ohne Inhalte geprüft
- [ ] Deployment (Hosting, HTTPS, Backups, Secrets)
- [ ] Regressionslauf aller Suites mit den gewählten Modellen (EVAL.md §5) – ohne neue Modellwahl
