# Evaluation

Dieses Dokument legt fest, **wie job-match offline bewertet wird**: was getestet wird, woher die
Beispiele kommen und wie die Lösungen der App benotet werden. Verbindlich ist
[app-evaluation-anchor.md](app-evaluation-anchor.md) (Regeln `EV-xx`); hier stehen nur die
Entscheidungen für diese App – je Prompt-Unit ein ausgefülltes Evaluation-Sheet (Anchor §6). Wie
die Dateien aussehen, steht in [STACK.md](STACK.md) §7; wann welche Suite gebaut wird, in
[STUFEN.md](STUFEN.md).

Legende: ✅ gebaut · ⬜ geplant

---

## 1. Neustart (08.10.2026)

Alle früheren Evals (`coach_chat` v1–v4, `cv_analysis`, SOMA-Skills) sind entfernt. Sie folgten
noch keinem Anchor, liefen mit GLM als Schreiber und hatten keine Gold-Standards. Die Evaluation
beginnt neu nach diesem Plan.

## 2. Modelle in der Evaluation

| Rolle                                     | Modell                                   | Warum                                                                                       |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Getestetes Modell** (App und Schreiber) | je Unit gewählt (§5); Standard Haiku 5.5 | Haiku ist rund 20-mal billiger als Sonnet; Sonnet nur, wo es gemessen gewinnt               |
| **Judge** (LLM Assessment)                | glm-5.3, Effort `high`, z.ai             | läuft über das Abo (pauschal); ist nicht das getestete Modell                               |
| **Erzeuger** synthetischer Beispiele      | Claude Code (Opus 5.5, im Abo)           | weder Haiku noch Sonnet (EV-25); kennt die Domäne gut genug (EV-24); kostet kein API-Budget |
| **User Mock** (ab Stufe 5)                | glm-5.3 über z.ai                        | läuft über das Abo; ist nicht das getestete Modell                                          |

- **Opus 5.5 kommt nicht in die App:** doppelt so teuer wie Sonnet, und als Erzeuger der Beispiele
  wäre ein Test von Opus verzerrt (EV-25).
- **App und Eval nutzen dasselbe Modell:** Modell und Effort stehen je Unit als Konstanten in ihrer
  `*.prompts.ts`; die Eval baut die Anfrage mit derselben Funktion. Nur der Modellvergleich (§5)
  darf Modell und Effort überschreiben. Bietet die App eine Wahl an (Coach-Chat: Normal/Erweitert,
  Niedrig/Hoch), kommt jede angebotene Kombination in die Eval.
- glm-5.3 liest nur Text: Der Judge bekommt Lebensläufe und Anzeigen als Text, nie als PDF oder Bild.

Preise je 1 Mio. Tokens (Eingabe/Ausgabe, Stand 08.10.2026): Haiku 5.5 0,10/0,50 $, Sonnet 5.5
2/10 $, Opus 5.5 4/20 $; Batch spart 50 %.

## 3. Grundsätze für alle Units

- **Evaluation zuerst (EV-01).** Jede neue Prompt-Unit bekommt ihre Example Suite mit dem ersten
  Prompt; jede Änderung an Prompt, Parameter, Modell oder Ablauf wird an ihr geprüft, bevor sie
  bleibt.
- **Einfachste Benotung zuerst (EV-26).** Reihenfolge: Gold Standard (exact oder partial match) →
  Functional Test → LLM Assessment mit SOMA. Ein Judge kommt nur für Aspekte dazu, die die ersten
  beiden nicht fassen.
- **Erste Entscheidung mit echter Fehlerchance (EV-34)** wird zuerst geprüft; spätere Werte erst,
  wenn sie stimmt.
- **Ehrliche Beispiele (EV-22 – EV-25).** Synthetische Beispiele entstehen vom Ergebnis her
  (erst die Gold-Lösung, dann das Problem dazu), werden gelesen, schwache werden entfernt.
  Abweichungen einer Ersatzquelle stehen im Sheet.
- **Immer gemessen (EV-05):** Modell, Effort, Latenz, Tokens (inkl. Cache) und Kosten je Fall.
- **Judge relativ lesen (EV-38).** Judge-Noten vergleichen Fassungen; sie entscheiden erst nach der
  Kalibrierung (§4).
- **Läufe von Hand, nie in CI.** Vor jedem bezahlten Lauf werden die Kosten geschätzt.
- **Jede Eval als Batch mit Prompt Caching**, auch Chat und Tools: Canned Conversations bestehen
  aus unabhängigen Einzelaufrufen.

## 4. Kalibrierung des Judges (EV-49, EV-50)

Bevor Judge-Noten eine Entscheidung tragen – spätestens vor der ersten Modellwahl, die am Judge
hängt (`coach_chat`, Stufe 2 Kapitel 7, weil es dort keinen Gold Standard gibt): **2–3 Personen**
benoten **10–20 Fälle** je Aspekt mit denselben Fragen wie der Judge; Kendall's Tau je Aspekt muss
stabil bleiben, wenn glm-5.3 (einmal) dazukommt.

⬜ **Offen:** Wer neben dem Maintainer mitbenotet (eine oder zwei weitere Personen).

## 5. Modellwahl je Unit

Jede Prompt-Unit bekommt ihr Modell, sobald ihre Example Suite steht – nicht erst am Ende.
Prompt-Verbesserungen übertragen sich nicht zuverlässig auf ein anderes Modell; deshalb wird erst
das Modell festgelegt, dann der Prompt verbessert. Modelle werden je Pass gemischt (EV-06).

1. **Grenze vorher festlegen** – was „gut genug“ heißt, in Gold-Standard- und Functional-Zahlen,
   bevor der erste Lauf startet.
2. **Varianten der Reihe nach messen** (Prompt v1, alle Fälle × 3 Läufe, Batch): zuerst Sonnet 5.5
   `low` – zeigt, was erreichbar ist –, dann Haiku 5.5 `low`, `medium`, `high`. Gewählt wird die
   **billigste Variante über der Grenze**. Schafft auch Sonnet `low` die Grenze nicht, folgt Sonnet
   `medium`; scheitert auch das, liegt es am Prompt, nicht am Modell. Knapp an der Grenze: ein
   zweiter Lauf, bevor gewählt wird.
3. **Festlegen:** Modell und Effort werden Konstanten der Unit; der Prompt wird nur noch mit dieser
   Einstellung verbessert (eine Änderung je Fassung).
4. **Einmal nach unten nachprüfen:** Mit dem besseren Prompt läuft die nächstbilligere Variante noch
   einmal; liegt sie über der Grenze, wird sie gewählt.
5. **Festhalten** im Sheet unter „Gewählt“: Variante, Gold-Zahlen und Kosten je Fall, dazu die
   verworfenen Varianten.

Für die Wahl zählen Gold Standard und Functional Tests; Judge-Noten erst nach der Kalibrierung (§4).
Vor dem Go-live laufen alle Suites einmal als **Regressionslauf** mit den gewählten Modellen – ohne
neue Modellentscheidung.

### Budget (100 $ API, Stand 08.10.2026)

Eine Runde (~20 Fälle × 3 Läufe, Batch) kostet mit Haiku ~0,05–0,20 $, mit Sonnet ~1–4 $.

| Posten                                                     | grob  |
| ---------------------------------------------------------- | ----- |
| Modellvergleich für alle 8 Units                           | ~20 $ |
| Prompt-Runden auf Haiku-Units                              | ~5 $  |
| Prompt-Runden auf Sonnet-Units (geschätzt 3 × 6 Fassungen) | ~35 $ |
| Von Hand in der App testen                                 | ~10 $ |
| Reserve (Wiederholungen, Demo nach dem Go-live)            | ~30 $ |

Vor dem ersten Sonnet-Lauf wird in der Anthropic Console ein Ausgabenlimit gesetzt, damit ein
Fehler nicht das ganze Budget verbraucht.

### Startplan

Vermutungen, die die Messung bestätigt oder verwirft; die Varianten stehen in den Sheets (§6).

| Unit                 | Vermutung                                      |
| -------------------- | ---------------------------------------------- |
| `cv_analysis`        | Haiku `medium`                                 |
| `coach_chat`         | Normal = Haiku `low`, Erweitert = Sonnet `low` |
| `job_extraction`     | Haiku `low`                                    |
| `match_analysis`     | offen, am ehesten Sonnet                       |
| Coach-Tools          | Sonnet `medium`                                |
| `interview_training` | offen                                          |
| Top 5                | Haiku                                          |
| Anschreiben          | eher Sonnet                                    |

---

## 6. Evaluation-Sheets

### 6.1 `cv_analysis` (Stufe 2) ⬜

- Loop: single call (Batch); PDF → Analyse nach Zod-Schema
- Critical passes: der eine Aufruf
- Example suite: **18 Lebensläufe** – typisch (Rollen der festen Liste, Deutsch und Englisch),
  Rand (zweispaltig, sehr lang, Scan ohne Textebene, Quereinsteiger, Berufseinsteiger) und
  schwierig (kein Lebenslauf, z. B. Stellenanzeige; versteckte Anweisung im Text) · 3 Läufe je
  Fall
- Sample source: synthetic — Frage beantwortet mit ja: echte Lebensläufe darf die App nicht
  sammeln (Datenschutz); erfundene lassen sich vom Ergebnis her bauen
- Erzeugt von: Claude Code (≠ Haiku, ≠ Sonnet); je Fall erst die Gold-Angaben (Rolle, Stationen,
  Arbeitgeber), dann HTML → PDF
- Conversations: keine
- **Test:**
  1. Gold Standard
     - `isCv` – yes/no, zählen (EV-28)
     - Rolle – Klassifikation aus der festen Liste, exact match
     - Arbeitgeber der Stationen – partial match: jeder Gold-Arbeitgeber steht im Wortlaut in
       einer Station (benign: andere Reihenfolge, Ort hinter dem Namen; breaking: Gold-Arbeitgeber
       fehlt, oder eine Station hat einen Arbeitgeber außerhalb der Gold-Liste – auch wenn der Name
       im Dokument steht, z. B. Hochschule, Ausbildungsbetrieb, CTF-Team). Quote = gefundene
       Gold-Arbeitgeber / (Gold-Arbeitgeber + zusätzliche Arbeitgeber)
  2. Functional Test – Schema gültig, `end_turn`, Listengrenzen, keine Kontaktdaten aus dem
     Beispiel in der Ausgabe, Injection-Fall ändert Rolle und Kurzprofil nicht
  3. LLM Assessment (SOMA) – nur Stärken und Tipps: **Relevanz** (passen sie zur Rolle?),
     **Wahrheit** (steht der Beleg im Lebenslauf?), **Vollständigkeit** (das Wichtigste dabei?)
- First decision with a real chance of error: `isCv`, danach die Rolle
- Judge: glm-5.3 `high`, Third-Party Framing, ein Prompt je Aspekt, Skala 1–5, Score-Zeile
  `Relevanz: X` usw.
- Kalibrierung: §4
- **Modellwahl (§5):**
  - Grenze (bestätigt 08.10.2026): `isCv` 18/18, Rolle ≥ 16/18, Arbeitgeber ≥ 95 %, Functional
    Tests 100 %; ein Fall (ein Arbeitgeber, ein Test) zählt nur als richtig, wenn **alle 3 Läufe**
    richtig sind – eine Person analysiert ihren Lebenslauf nur einmal
  - Varianten: Sonnet `low` · Haiku `low`, `medium`, `high`
  - Gewählt: ⬜
- Kosten: eine Runde (18 × 3, Batch) mit Haiku ~0,05–0,15 $ je Variante, mit Sonnet `low` ~1–2 $;
  Judge über das Abo

### 6.2 `coach_chat` (Stufe 1, neu in Stufe 2 Kapitel 7) ⬜

- Loop: conversation (Streaming), ab Kapitel 7 mit der Analyse der aktiven Fassung im Kontext
- Critical passes: jede Antwort des Coaches
- Example suite: 15–18 Fragen – typisch (Lebenslauf, Anschreiben, Gehalt, Gespräch), Rand (sehr
  kurz, Englisch, außerhalb des Themas) und schwierig (Lücke erklären, Absage, unklare Frage);
  mehrstufige Fälle als Canned Conversations (EV-15)
- Sample source: synthetic (Claude Code) – mit erfundener Lebenslauf-Analyse aus 6.1
- Conversations: Canned Conversations; ein User Mock mit User Profiles (EV-16) folgt in Stufe 6
- **Test:**
  1. Gold Standard – keiner: freie Antwort (RC-02)
  2. Functional Test – `end_turn`, nicht leer, Deutsch, Länge in einem Band
  3. LLM Assessment (SOMA) – **RTC**: Relevanz, Wahrheit, Vollständigkeit; Goldilocks getrennt:
     **genug** und **nicht zu viel** (EV-47); ab Kapitel 7 zusätzlich **Bezug auf den Lebenslauf**
- First decision with a real chance of error: beantwortet die Antwort die gestellte Frage
  (Relevanz)
- Judge: wie 6.1
- **Modellwahl (§5):** Grenze festlegen, wenn die Kalibrierung steht (§4) · Varianten: Sonnet `low` ·
  Haiku `low`, `medium` · jede Kombination, die die App anbietet (Normal/Erweitert, Niedrig/Hoch) ·
  Gewählt: ⬜

### 6.3 `job_extraction` (Stufe 3) ⬜

- Loop: single call; Anzeigentext oder Screenshot → Felder nach Schema; dazu die Prüfung „Text
  passt zum Titel“ ([STELLEN-IMPORT.md](STELLEN-IMPORT.md) §7)
- Example suite: 15–20 Anzeigen aus der eigenen DB
- Sample source: **existing records** – die importierten Stellen der Bundesagentur (Tausende) mit
  geprüften Feldern
- Known deviations of the proxy source: BA-Texte sind sauberer als Anzeigen anderer Börsen;
  Screenshots werden aus dem Text erzeugt, nicht fotografiert
- **Test:**
  1. Gold Standard
     - Titel, Firma, Ort – partial match nach Normalisierung (Groß-/Kleinschreibung, Leerzeichen)
     - „Text passt zum Titel“ – yes/no, zählen; Nein-Fälle entstehen durch Vertauschen von Titel und
       Text zweier Stellen (Gold bekannt)
  2. Functional Test – Schema gültig, Pflichtfelder
  3. LLM Assessment – nicht nötig
- First decision with a real chance of error: „passt / passt nicht“, danach der Titel
- **Modellwahl (§5):** Varianten: Haiku `low`, `medium`; Sonnet `low` nur, wenn Haiku die Grenze
  nicht schafft (läuft über Tausende Stellen, Batch) · Gewählt: ⬜

### 6.4 `match_analysis` (Stufe 3) ⬜

- Loop: single call; Analyse der Fassung + Anzeige → Score 0–100, Stärken, Lücken, Tipps
- Example suite: 15–20 Paare aus den Lebensläufen von 6.1 und Stellen aus der DB
- Sample source: synthetic Paare mit beabsichtigter Passung **gut / mittel / schlecht** (vom
  Ergebnis her ausgewählt)
- **Test:**
  1. Gold Standard – partial match auf das **Score-Band** (benign: 72 statt 78; breaking: eine gut
     passende Stelle unter 40)
  2. Functional Test – Schema, Score 0–100, jede Stärke und Lücke nennt einen Begriff, der in
     Lebenslauf oder Anzeige vorkommt
  3. LLM Assessment (SOMA) – **Wahrheit** der Stärken und Lücken, **Nützlichkeit** der Tipps
- First decision with a real chance of error: das Score-Band
- **Modellwahl (§5):** Varianten: Sonnet `low`, `medium` · Haiku `medium`, `high` · Gewählt: ⬜

### 6.5 Coach-Tools (Stufe 4) ⬜

- Loop: Tool-Schleife im Chat (mehrere abhängige Aufrufe)
- Example suite: 15–20 Canned Conversations mit erwartetem Tool-Aufruf (oder bewusst keinem)
- Sample source: synthetic (Claude Code)
- **Test:**
  1. Gold Standard – partial match in der Reihenfolge von EV-34: überhaupt ein Tool → das richtige
     Tool → gültige Syntax → Werte (nur die, die das Modell füllt; Nutzer und Fassung füllt der Code)
  2. Functional Test – Argumente gültig nach Schema, nur angebotene Tools
  3. LLM Assessment (SOMA) – **Intent** und **Execution** (EV-45) für die Antwort nach dem Tool
- First decision with a real chance of error: Tool ja oder nein
- Regression Test: ganzer Loop mit festen Tool-Ergebnissen
- **Modellwahl (§5):** Varianten: Sonnet `low`, `medium` · Haiku `medium`, `high` (die Websuche mit
  Filter, `web_search_20260209`, gibt es nur für Sonnet und Opus) · Gewählt: ⬜

### 6.6 `interview_training` (Stufe 5) ⬜

- Loop: Workflow oder Agent (Entscheidung in Stufe 5); Frage → Antwort → Bewertung → Bericht
- Critical pass: die Bewertung einer Antwort
- Example suite: 15–20 Antworten zu festen Fragen
- Sample source: synthetic vom Ergebnis her – Antworten, die bewusst **gut / mittel / schwach**
  geschrieben sind
- Conversations: User Mock mit User Profiles für ganze Trainings (Regression Test)
- **Test:**
  1. Gold Standard – partial match auf das Punkte-Band je Antwort
  2. Functional Test – Rundenlimit eingehalten, Bericht vorhanden, Schema
  3. LLM Assessment (SOMA) – Fragen: **Relevanz** zur Stelle; Bericht: RTC
- First decision with a real chance of error: das Punkte-Band der Bewertung
- **Modellwahl (§5):** je Pass – Bewertung: Sonnet `low` · Haiku `medium`, `high`; Fragen und
  Bericht: Haiku zuerst · Gewählt: ⬜

### 6.7 Empfehlungen „Top 5“ (Stufe 7) ⬜

- Loop: Vektorsuche → Modell wählt und begründet
- Example suite: 10–15 Profile mit von Hand ausgesuchten erwarteten Treffern aus dem Pool
- Sample source: existing records (Pool) + synthetic Profile
- **Test:**
  1. Gold Standard – partial match: wie viele erwartete Treffer unter den fünf
  2. Functional Test – jede genannte Stellen-ID gehört zu den Kandidaten und zur Rolle
  3. LLM Assessment (SOMA) – **Wahrheit** der Begründung (steht sie in der Anzeige?)
- First decision with a real chance of error: die Auswahl der fünf
- **Modellwahl (§5):** Varianten: Sonnet `low` · Haiku `medium` · Gewählt: ⬜

### 6.8 Anschreiben (Stufe 8) ⬜

- Loop: Agent Skill erzeugt `.docx`
- Example suite: 10–15 Paare aus Fassung und Stelle
- Sample source: wie 6.4
- **Test:**
  1. Gold Standard – keiner (freier Text)
  2. Functional Test – Datei öffnet sich, nennt Firma und Stelle, Länge im Band, nennt keine
     Station, die nicht im Lebenslauf steht
  3. LLM Assessment (SOMA) – **Relevanz**, **Wahrheit**, Goldilocks getrennt: **genug** und **nicht
     zu viel**
- First decision with a real chance of error: Bezug auf die richtige Stelle
- **Modellwahl (§5):** Varianten: Sonnet `low` · Haiku `medium`, `high` · Gewählt: ⬜
