# Stufenplan

Dieses Dokument legt fest, **in welcher Reihenfolge** job-match gebaut wird und was jede Stufe
technisch umfasst. Was die App fachlich kann, steht in [IDEE.md](IDEE.md); wie Code aussieht, in
[STACK.md](STACK.md); wie Prompts geschrieben werden, in
[app-prompting-anchor.md](app-prompting-anchor.md).

Legende: `[x]` erledigt · `[ ]` offen

---

## 1. Grundregeln

- **Eine Stufe nach der anderen.** Jede Stufe ist lauffähig, getestet und committet, bevor die
  nächste beginnt. Was erst später dran ist, wird vorher nicht eingebaut.
- **Jede Stufe führt ein Claude-Thema ein** und hält fest, was dabei gelernt wurde (Abschnitt
  „Lernziele“). Ein Lernziel gilt erst als erreicht, wenn es sich in eigenen Worten erklären und im
  Code zeigen lässt.
- **Jede KI-Funktion ist eine Prompt-Unit** mit Steckbrief (Form, Archetyp, Surface, Slots, Stopp,
  was der Code erzwingt) und bekommt ab der ersten Version eine Beispiel-Suite (STACK.md §7).
- **Claude ist das Ziel.** Während der Entwicklung darf ein kompatibler Anbieter laufen (z. B. z.ai
  über `ANTHROPIC_BASE_URL`); Funktionen, die nur Claude kann (PDF, Structured Outputs, Caching …),
  werden trotzdem für Claude gebaut und mit einem Fake getestet.
- **Kosten sichtbar machen:** Jede Modellanfrage protokolliert Modell, Effort, Tokens und Dauer.

**Fertig heißt bei jeder Stufe:** Punkte abgehakt, `pnpm lint`/`format:check`/`typecheck`/`test`
grün, CI grün, README aktualisiert, Lernziele abgehakt.

---

## 2. Überblick

| Stufe   | Fachlich (siehe IDEE.md)                                | Claude-Thema                                         |
| ------- | ------------------------------------------------------- | ---------------------------------------------------- |
| 0       | Fundament: leeres Backend + Frontend, DB, CI            | Client, Konfiguration, Fake fürs Testen              |
| 1       | Konto + Coach-Chat                                      | Messages API, Streaming, System-Prompt, Stopp-Gründe |
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

- [x] Paket `shared/` mit Zod; erstes Schema `HealthResponse`, von Backend und Frontend importiert

**Backend**

- [x] `backend/` mit Express 5, TypeScript strict, `tsx` (`pnpm dev` mit Neustart bei Änderungen)
- [x] `config.ts`: Konfiguration aus `.env` (DB-URL, API-Key, Base-URL, Log-Level, Timeouts) mit Zod
      beim Start geprüft; Platzhalter-Key wird abgelehnt
- [x] `db.ts` + Drizzle eingerichtet; erste Migration aktiviert `pgvector`
- [x] `createApp(deps)` mit `GET /api/health` (prüft auch die DB-Verbindung) und zentraler
      Fehler-Middleware
- [x] `llm/`: Client-Fabrik (Anthropic-SDK mit Base-URL, Timeout, Retries) und Modell-Zuordnung je
      Anbieter; ein Fake-Client für Tests
- [x] `pnpm llm:check`: ein kurzer echter Aufruf, zeigt Modell, Tokens, Dauer (von Hand, kostet)
- [x] Logging mit `pino` ohne Inhalte; Vitest + supertest eingerichtet und grün

**Frontend**

- [x] `frontend/` mit Vite, Vue 3, TypeScript strict, Tailwind v4, shadcn-vue, Pinia, Vue Router
- [x] Vite-Proxy `/api` → Backend; Seite `/status` zeigt den Health-Check, Antwort mit dem Schema aus
      `shared` geprüft
- [x] ESLint, Prettier, Vitest, `vue-tsc` grün

**Lernziele**

- [ ] pnpm-Workspace: Pakete, gemeinsames Lockfile, `--filter`, ein Paket importiert ein anderes
- [ ] Express 5: App-Fabrik, Router, Middleware, Fehler-Middleware, `async`-Handler
- [ ] Zod: Schema einmal schreiben, für Konfiguration, Request und Frontend-Typen nutzen
- [ ] Drizzle + drizzle-kit: Tabellen, Verbindung, Migration erzeugen und anwenden
- [ ] Anthropic-SDK: Client, Base-URL, Timeout, Retries, Fehlerklassen
- [ ] Warum Tests nie das echte Modell aufrufen – und wie ein Fake die Stream-Formen nachbildet

---

## Stufe 1 – Konto + Coach-Chat

**Ziel:** Anmelden und mit dem Coach chatten; Antworten erscheinen live, Gespräche bleiben
gespeichert. Registrierung bleibt bis zum Go-live per Einstellung gesperrt.

**Konto**

- [ ] Tabellen `users`, `auth_tokens`; Registrieren, Anmelden, Abmelden, `me`
- [ ] Opake Tokens (256 Bit, nur SHA-256 in der DB, Ablaufdatum), `scrypt` für Passwörter
- [ ] Gleiche Antwort bei unbekannter E-Mail und falschem Passwort; Rate-Limit für Login/Registrierung
- [ ] `REGISTRATION_ENABLED` (Standard: aus)

**Coach-Chat**

- [ ] Tabellen `conversations`, `messages` (Inhalt als JSON-Inhaltsblöcke, nicht nur Text – nötig
      für Tools und Compaction später)
- [ ] `POST /api/chat` als Server-Sent Events: `conversation`, `delta`, `done`, `refusal`, `error`
- [ ] Verlauf aus der DB; Nutzernachricht vor, Antwort nach dem Aufruf speichern (auch Teilantwort
      bei Abbruch, nie eine leere); Abbruch, wenn der Browser die Verbindung trennt
- [ ] Gespräche auflisten, laden, umbenennen, löschen (nur eigene, sonst 404)
- [ ] Stopp-Gründe auswerten: `max_tokens`, `refusal` (Teilantwort verwerfen), leere Antwort
- [ ] Modell- und Effort-Wahl (Normal/Erweitert, Niedrig/Hoch), Effort immer explizit senden

**Prompt-Unit `coach_chat`**

| Form            | Archetyp            | Surface          | Slots                                   | Stopp        | Code erzwingt                       |
| --------------- | ------------------- | ---------------- | --------------------------------------- | ------------ | ----------------------------------- |
| multi-turn chat | advice conversation | Markdown im Chat | Verlauf (indirekt, begrenzt), Nachricht | eine Antwort | Markdown bereinigen, Verlaufsgrenze |

- [ ] Prompt nach Anchor §7 (Frame, Regeln mit Begründung, Scope-Satz) mit Kopfkommentar
- [ ] Beispiel-Suite `evals/coach_chat/` mit 5–10 typischen Fragen

**Frontend**

- [ ] Login, Chat-Seite mit Seitenleiste, Streaming, Stopp, „Erneut versuchen“, Kopieren
- [ ] Markdown sicher rendern; Hinweis bei gekürzter Antwort

**Lernziele**

- [ ] Messages API: zustandslos, Rollen, `system`, `max_tokens`, `stop_reason`
- [ ] Streaming mit dem SDK und als SSE an den Browser; Abbruch per Signal
- [ ] Effort und adaptives Thinking: was sie kosten, wie man sie steuert
- [ ] Tokenverbrauch loggen und Kosten abschätzen
- [ ] Sicherheit: Hash statt Klartext, Nutzer-Enumeration, Ownership-Check, 404 statt 403

---

## Stufe 2 – Lebenslauf und Profil

**Ziel:** Lebenslauf als PDF hochladen, einmal analysieren, Ergebnis speichern; die Rolle bestätigen;
neue Fassungen ersetzen die alte; der Coach kennt die aktive Fassung.

- [ ] Domäne `profile`: Tabelle für Fassungen (PDF, Analyse als JSON, Rolle, aktiv/archiviert)
- [ ] PDF-Upload (Größenlimit, nur PDF), Original bleibt gespeichert und abrufbar
- [ ] Analyse **einmal** pro Fassung; Ergebnis als geprüftes Schema gespeichert
- [ ] Rollen-Vorschlag aus einer festen Liste; Bestätigen oder andere wählen
- [ ] Neue Fassung macht die alte inaktiv; alte Fassung reaktivieren ohne neue Analyse
- [ ] Coach-Chat bekommt die Analyse der aktiven Fassung als Kontext (nicht das PDF)
- [ ] Lebensläufe auf Deutsch und Englisch

**Prompt-Unit `cv_analysis`**

| Form        | Archetyp            | Surface              | Slots        | Stopp          | Code erzwingt                        |
| ----------- | ------------------- | -------------------- | ------------ | -------------- | ------------------------------------ |
| single call | structured document | geprüftes Zod-Objekt | PDF (direkt) | Schema erfüllt | Schema, Rolle aus Liste, Größenlimit |

- [ ] Beispiel-Suite mit 5–10 echten oder erfundenen Lebensläufen (keine fremden Personendaten)

**Lernziele**

- [ ] PDF als `document`-Block; Grenzen (Seiten, Größe)
- [ ] Structured Outputs mit Zod (`messages.parse`): garantiert vs. nur erbeten
- [ ] Warum „einmal analysieren und speichern“ billiger ist als das PDF bei jeder Nachricht
- [ ] Wann man mehr Effort braucht – an der Beispiel-Suite gemessen

---

## Stufe 3 – Stellen und Match-Analyse

**Ziel:** Eigene Stellen speichern (Text oder Screenshot) und sehen, wie gut die aktive Fassung passt.

- [ ] Domäne `jobs`: Stelle (Titel, Firma, Ort, Text, Quelle/Link, Sprache)
- [ ] Screenshot einer Anzeige → Text (Vision)
- [ ] Domäne `matching`: Score 0–100, Stärken, Lücken, Tipps (zweigeteilt, falls bestätigt);
      gespeichert, nicht jedes Mal neu berechnet; bei Fassungswechsel ins Archiv
- [ ] Anzeigentext geht als markierter Block in den Prompt (fremder Text = Daten)
- [ ] Nachfragen zum Ergebnis im Coach-Chat

**Prompt-Units**

| Unit             | Form        | Archetyp            | Surface        | Stopp          | Code erzwingt                  |
| ---------------- | ----------- | ------------------- | -------------- | -------------- | ------------------------------ |
| `job_extraction` | single call | structured document | Zod-Objekt     | Schema erfüllt | Schema, Pflichtfelder          |
| `match_analysis` | single call | structured document | Ergebnis-Karte | Schema erfüllt | Score 0–100, Bezug auf Angaben |

- [ ] Beispiel-Suite für `match_analysis` mit **prüfbaren Kriterien** (z. B. erwarteter Score-Bereich
      je Fall) – der erste echte Eval

**Lernziele**

- [ ] Vision: Bild als Content-Block, Formate und Grenzen
- [ ] Eval mit Kriterien: Gold-Fälle, Score-Bereiche, Vergleich zweier Prompt-Versionen
- [ ] Prompt Injection: warum Anzeigentext nie Anweisung sein darf, und was der Code prüft

---

## Stufe 4 – Bewerbungen und Coach-Tools

**Ziel:** Bewerbungen mit Status, Verlauf und Notizen führen; der Coach kann im Chat handeln.

- [ ] Domäne `applications`: Bewerbung, Statusverlauf mit Datum, Notizen mit Datum
- [ ] Seite „Bewerbungen“: Liste, Status ändern, Notizen; bleiben bei Rollenwechsel sichtbar
- [ ] Tools für den Coach: Stelle speichern, Status setzen, Interviewfragen erzeugen
- [ ] Server-Tool Websuche: Infos zur Firma
- [ ] Tool-Schleife im Chat; SSE-Events zeigen, was der Coach gerade tut
- [ ] Werte, die die App kennt (Nutzer, aktive Fassung), füllt der Code – nicht das Modell

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
- [ ] Beispiel-Suite mit Antworten unterschiedlicher Qualität

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
- [ ] Qualität messen: kleine Testmenge mit erwarteten Treffern

**Lernziele**

- [ ] RAG: suchen → auswählen → in den Prompt → begründete Antwort
- [ ] Embeddings, Kosinus-Ähnlichkeit, HNSW-Index, Chunking
- [ ] Message Batches: wann sie sich lohnen

---

## Stufe 8 – Unterlagen und Termine

**Ziel:** Anschreiben als Word-Datei; Interviewtermine im Kalender.

- [ ] Anschreiben passend zu Stelle und aktiver Fassung, als `.docx` per Agent Skill
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
