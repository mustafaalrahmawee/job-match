# Was dieses Projekt zeigt

Stand: 10. November 2026

Die App selbst ist absichtlich gewöhnlich: Login, Chat, Datei-Upload, Listen, Formulare. Das
Besondere liegt darin, **wie jeder Modellaufruf entworfen, abgesichert und gemessen wird** und wie
das Projekt mit Claude Code als Werkzeug gebaut wird, ohne dass der Code zu Vibe-Coding wird.

Diese Seite ist für eine Person, die das Repo in zehn Minuten beurteilen will. Jede Behauptung steht
mit der Datei, in der man sie prüfen kann. Was noch nicht gebaut ist, steht am Ende.

## Wer macht was

Claude Code schreibt den meisten Code; deshalb steht es als Co-Autor in jedem Commit. Die
Entscheidungen davor und danach trifft der Autor:

- **Die Methode.** Interne Leitfäden legen fest, wie ein Prompt geschrieben wird, destilliert aus
  Berryman/Ziegler, _Prompt Engineering for LLMs_ (O'Reilly 2025), und wie ein Agent
  gebaut wird, nach Kyle Stratis, _AI Agents with MCP_ (O'Reilly 2026), jeweils mit
  angenommenen und abgelehnten Konzepten. Der Leitfaden für Evals entsteht neu.
- **Der Plan.** Domänenmodell und Use Cases je Stufe stehen fest, bevor Code entsteht.
- **Die Werkzeuge.** Skills und Subagenten binden Claude Code an diese Methode. Welche Rolle welches
  Modell bekommt und was es darf, ist dort festgelegt.
- **Jede Entscheidung je Prompt.** Zu jeder Prompt-Unit gibt es ein Blatt mit Analyse und
  Entscheidung je Schritt. Offene Punkte darin entscheidet der Autor, nicht das Modell.
- **Jedes Review.** Jeder Use Case geht durch ein Review von einem zweiten, unabhängigen Modell; die
  Funde prüft der Autor am Code und entscheidet, was behoben und was abgelehnt wird.

Diese Arbeitsdokumente liegen nicht im öffentlichen Repo; auf Nachfrage zeige ich sie gern.

## In zehn Minuten prüfen

| Behauptung | Wo nachlesen | Was man dort sieht |
| --- | --- | --- |
| Jeder Prompt-Teil ist benannt und einzeln nachvollziehbar | [job_extract/](../backend/src/prompts/job_extract/) | jeder Teil als benannte Konstante, der Kopfkommentar nennt Profil, Slots, Stop und was der Code statt des Prompts erzwingt |
| App und Eval bauen dieselbe Anfrage | [cv_analysis.request.ts](../backend/src/prompts/cv_analysis/cv_analysis.request.ts), Funktion `cvAnalysisRequest` | eine Funktion je Unit; der Service ruft sie, die Eval ruft sie mit einer `Variant` für Modell und Effort |
| Prompt passt ins Eingabebudget | [assemble.ts](../backend/src/llm/assemble.ts) | jeder Teil der Anfrage ist ein Element mit Position, Stufe und Score; `assemble` wählt vor dem Senden, was ins Budget passt |
| Structured Outputs ohne doppeltes Schema | [job_extract.schemas.ts](../backend/src/prompts/job_extract/job_extract.schemas.ts), `jobExtractSchema` | ein Zod-Schema validiert die Antwort, `z.toJSONSchema()` daraus geht als `output_config.format` an die API |
| Prompt-Injection wird strukturell behandelt, nicht mit Verboten | [job_extract/](../backend/src/prompts/job_extract/), `markedText`, `jobPrompt.FOREIGN` und `jobExtractResult` | eingefügter Text geht als Document-Block und zusätzlich zwischen zwei Tags mit einer Kennung, die bei jedem Aufruf neu zufällig gewählt wird und die der Text nicht kennen kann; der Absatz zum fremden Material erklärt Anweisungen im Material zum Material; was gelten muss, prüft der Code: Zod, Wortlaut, Adressen und unsichtbare Zeichen in `jobExtractResult` |
| Modellwahl ist ein Kosten-Latenz-Qualität-Trade-off | [prompts/](../backend/src/prompts/) | Modell und Effort je Unit als Konstante: Haiku für Extraktion und Fragen, Sonnet für Analyse und Bewertung; Opus nirgends, bis eine Messung es verlangt |
| Kosten werden je Aufruf gemessen, mit Cache | [costs.ts](../backend/src/llm/costs.ts), [cvs.service.ts](../backend/src/modules/cvs/cvs.service.ts) | Preistabelle mit Cache-Read und Cache-Write, Batch-Rabatt; Tokens und Kosten werden am Datensatz gespeichert |
| Claude-API-Funktionen dort, wo sie fachlich passen | [send.ts](../backend/src/llm/send.ts), [cvs.service.ts](../backend/src/modules/cvs/cvs.service.ts), [cv_analysis.request.ts](../backend/src/prompts/cv_analysis/cv_analysis.request.ts) | Streaming mit Abbruch und Teilantwort; die Lebenslauf-Analyse als direkter Aufruf mit Zeitlimit statt als Batch, weil Stellen, Match und Coach auf das Ergebnis warten; PDF als Document-Block; Screenshot als Image-Block; adaptives Thinking mit Effort |
| Jeder Stop-Grund hat eine Behandlung | [coach.service.ts](../backend/src/modules/coach/coach.service.ts) | `refusal` wird geloggt und nicht gespeichert, leere Antwort nicht gespeichert – außer an der Grenze der Fortsetzungen (`pause_turn`), damit Schrittzeilen und der Hinweis der App bleiben –, unbekannter Grund wirft einen Fehler |
| Backend-Architektur, die sich testen lässt | [app.ts](../backend/src/app.ts) | ein Composition Root, Module je Domäne, Services mit Abhängigkeiten im Konstruktor, feste Fehlerabbildung; 242 Vitest-Fälle im Backend mit Supertest gegen eine eigene Testdatenbank, 58 im Frontend mit `@vue/test-utils` |
| Sicherheit im Kleinen | [auth.security.ts](../backend/src/modules/auth/auth.security.ts), [auth.service.ts](../backend/src/modules/auth/auth.service.ts) | argon2, Dummy-Hash gegen Timing-Unterschiede bei unbekannter E-Mail, Token nur als SHA-256 gespeichert; fremde Datensätze antworten mit 404 |

## Wie ein Use Case entsteht

Am Beispiel UC-08, eine eigene Stelle aus Text oder Screenshot speichern:

1. **Zeile im Plan.** Der Plan nennt Ergebnis und Stufe und schätzt Modell und Effort (Haiku 5.5,
   `medium`).
2. **Prompt-Blatt.** Ein Schreiber-Agent füllt die zwölf Schritte des Prompt-Leitfadens, ein
   Prüfer-Agent meldet Funde gegen den Leitfaden, eine Runde Überarbeitung, dann Pause. Offene
   Punkte entscheidet der Autor, etwa ob das Modell für eine Anzeige ohne Firmennamen raten darf
   (nein).
3. **Code der Unit.** Der Schreiber setzt das Blatt in [job_extract/](../backend/src/prompts/job_extract/)
   um, der Prüfer vergleicht Blatt und Code Wort für Wort.
4. **Use Case.** Claude Code schreibt Kontext, Backend, Frontend und Tests, dann fordert es das
   Review an. Codex prüft nur lesend gegen die Anforderung und die Projektregeln und antwortet mit
   nummerierten Funden.
5. **Fixes und Abschluss.** Jeder Fund wird am Code geprüft, behoben oder mit Grund abgelehnt;
   Re-Review; der Autor liest die Tabelle, sieht den Diff und committet.

## Entscheidungen, die vorher getroffen wurden

- **Erst bauen, dann messen.** Erst alle Use Cases mit geschätztem Modell, dann Unit für Unit
  messen. Grund: Schätzen ist billig, Messen kostet Budget; eine Messung an einer halb fertigen App
  misst das Falsche.
- **Budget.** 100 $ API-Budget für das ganze Projekt, 25 $ davon für Evals. Judge und Reviewer
  laufen deshalb auf Codex mit dem ChatGPT-Abo, Beispiele schreibt Claude Code aus dem Abo.
- **Caching nur bei häufigem Lesen.** Der Lebenslauf-Upload bekommt kein `cache_control`, weil der
  Prefix nur einmal gelesen wird; ob der Coach es bekommt, entscheidet eine Messung in seiner Eval.
- **Kein Modell bewertet die eigene Arbeit.** Gilt für Prompts (Opus schreibt, Codex prüft), für
  Beispiele (Claude schreibt, Codex prüft) und für Code (Claude schreibt, Codex prüft).
- **Was gelten muss, prüft der Code.** Der Prompt bittet; Zod, Enum und Längenprüfung erzwingen.
  Jeder Kopfkommentar einer Unit trennt „Enforced in code“ von „Requested only“.
- **Die niedrigste Stufe, die die Aufgabe löst.** Die Treppe heißt: Formular und Code, ein
  Modellaufruf, Modell mit Werkzeug, Workflow, Agent. Jede Funktion bekommt die unterste Stufe, die
  sie löst, und jede Unit das billigste Modell, das ihre Eval besteht. Beispiel Coach (UC-11):
  Stelle speichern und Status setzen gibt es schon als Formular (UC-08, UC-10), sie bleiben Code.
  Der Coach bekommt nur ein lesendes Werkzeug, die Bewerbung lesen, weil nur dort das Modell etwas
  kann, was Code nicht kann: Interviewfragen aus Anzeige und Lücken schreiben. Die Firmenrecherche
  läuft als eigene Unit `company_research` mit der Websuche, weil die Zahl der Suchen vorher offen
  ist; die Person startet sie per Formular, und die Unit bekommt keine privaten Daten. Schreibende
  Werkzeuge im Chat hätten die Oberfläche verdoppelt und das größte Risiko gebracht: eine Anweisung
  in einer Anzeige oder Webseite hätte Daten der Person ändern können.

## Was noch nicht gebaut ist

- **Stufe 1 bis 4 sind gebaut** (UC-01 bis UC-11), zuletzt der Coach mit lesenden Werkzeugen.
- **Als Nächstes werden alle Prompts neu geschrieben,** Unit für Unit nach dem Prompt-Leitfaden.
- **Die Evals sind nicht begonnen.** Leitfaden, Beispielfälle und Prüfungen entstehen nach den
  Prompts neu. Die Modellwahl je Unit ist bis dahin eine begründete Schätzung, keine Messung.
- **Go-live fehlt:** Registrieren und Konto (UC-13).

## Leseweg für 15 Minuten

1. [job_extract/](../backend/src/prompts/job_extract/): eine Prompt-Unit Datei für Datei –
   Konstanten, Schema, Prompt-Teile, Material, Prüfung der Antwort, Request-Funktion.
2. [assemble.ts](../backend/src/llm/assemble.ts): wie aus den Teilen die Anfrage im Budget wird.
3. [send.ts](../backend/src/llm/send.ts) und [costs.ts](../backend/src/llm/costs.ts): Senden,
   Streaming, Kosten.
4. [coach.service.ts](../backend/src/modules/coach/coach.service.ts): die Agent-Schleife mit
   lesenden Werkzeugen und Stop-Gründen.
5. [app.ts](../backend/src/app.ts): wie alles zusammengesteckt wird.
