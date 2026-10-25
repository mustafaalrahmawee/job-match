# Was dieses Projekt zeigt

Stand: 24. Oktober 2026

Die App selbst ist absichtlich gewöhnlich: Login, Chat, Datei-Upload, Listen, Formulare. Das
Besondere liegt darin, **wie jeder Modellaufruf entworfen, abgesichert und gemessen wird** und wie
das Projekt mit Claude Code als Werkzeug gebaut wird, ohne dass der Code zu Vibe-Coding wird.

Diese Seite ist für eine Person, die das Repo in zehn Minuten beurteilen will. Jede Behauptung steht
mit der Datei, in der man sie prüfen kann. Was noch nicht gebaut ist, steht am Ende.

## Wer macht was

Claude Code schreibt den meisten Code; deshalb steht es als Co-Autor in jedem Commit. Die
Entscheidungen davor und danach trifft der Autor:

- **Die Methode.** Zwei interne Leitfäden legen fest, wie ein Prompt geschrieben und wie eine Eval
  gebaut wird, destilliert aus Berryman/Ziegler, _Prompt Engineering for LLMs_ (O'Reilly 2025),
  Kapitel 4 bis 8 und 10, mit angenommenen und abgelehnten Konzepten.
- **Der Plan.** Domänenmodell, Use Cases je Stufe und ein Eval-Plan je Prompt-Unit mit Schwellen und
  Modellwahl stehen fest, bevor Code entsteht.
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
| Jeder Prompt-Teil ist benannt und einzeln nachvollziehbar | [job_extract.ts](../backend/src/prompts/job_extract.ts) | jeder Teil als benannte Konstante, der Kopfkommentar nennt Profil, Slots, Stop und was der Code statt des Prompts erzwingt |
| App und Eval bauen dieselbe Anfrage | [cv_analysis.ts](../backend/src/prompts/cv_analysis.ts), Funktion `cvAnalysisRequest` | eine Funktion je Unit; der Service ruft sie, die Eval ruft sie mit einer `Variant` für Modell und Effort |
| Prompt passt ins Eingabebudget | [assemble.ts](../backend/src/llm/assemble.ts) | jeder Teil der Anfrage ist ein Element mit Position, Stufe und Score; `assemble` wählt vor dem Senden, was ins Budget passt |
| Structured Outputs ohne doppeltes Schema | [job_extract.ts](../backend/src/prompts/job_extract.ts), `jobExtractSchema` | ein Zod-Schema validiert die Antwort, `z.toJSONSchema()` daraus geht als `output_config.format` an die API |
| Prompt-Injection wird strukturell behandelt, nicht mit Verboten | [job_extract.ts](../backend/src/prompts/job_extract.ts), `materialBlock` und `JOB_EXTRACT_FRAME` | eingefügter Text geht als Document-Block mit Blockgrenze, nicht in einem Tag, das der Text selbst schließen könnte; der Frame erklärt Anweisungen im Material zum Material; was gelten muss, prüft Zod |
| Modellwahl ist ein Kosten-Latenz-Qualität-Trade-off | [prompts/](../backend/src/prompts/) | Modell und Effort je Unit als Konstante: Haiku für Extraktion und Fragen, Sonnet für Analyse und Bewertung; Opus nirgends, bis eine Messung es verlangt |
| Kosten werden je Aufruf gemessen, mit Cache | [costs.ts](../backend/src/llm/costs.ts), [cvs.service.ts](../backend/src/modules/cvs/cvs.service.ts) | Preistabelle mit Cache-Read und Cache-Write, Batch-Rabatt; Tokens und Kosten werden am Datensatz gespeichert |
| Eval-Prüfungen sind Code, nicht Prosa | [checks.ts](../backend/evals/checks.ts), [checks.test.ts](../backend/tests/evals/checks.test.ts) | Sprache mit `franc`, Wortzahl, verbotene Phrasen, Stop-Grund; die Prüfungen sind selbst getestet |
| Claude-API-Funktionen dort, wo sie fachlich passen | [send.ts](../backend/src/llm/send.ts), [batch.ts](../backend/src/llm/batch.ts), [cv_analysis.ts](../backend/src/prompts/cv_analysis.ts) | Streaming mit Abbruch und Teilantwort; Message Batches für die Lebenslauf-Analyse; PDF als Document-Block; Screenshot als Image-Block; adaptives Thinking mit Effort |
| Jeder Stop-Grund hat eine Behandlung | [coach.service.ts](../backend/src/modules/coach/coach.service.ts) | `refusal` wird geloggt und nicht gespeichert, leere Antwort nicht gespeichert – außer an der Grenze der Fortsetzungen (`pause_turn`), damit Schrittzeilen und der Hinweis der App bleiben –, unbekannter Grund wirft einen Fehler |
| Backend-Architektur, die sich testen lässt | [app.ts](../backend/src/app.ts) | ein Composition Root, Module je Domäne, Services mit Abhängigkeiten im Konstruktor, feste Fehlerabbildung; 207 Vitest-Fälle im Backend mit Supertest gegen eine eigene Testdatenbank, 47 im Frontend mit `@vue/test-utils` |
| Sicherheit im Kleinen | [auth.security.ts](../backend/src/modules/auth/auth.security.ts), [auth.service.ts](../backend/src/modules/auth/auth.service.ts) | argon2, Dummy-Hash gegen Timing-Unterschiede bei unbekannter E-Mail, Token nur als SHA-256 gespeichert; fremde Datensätze antworten mit 404 |

## Wie ein Use Case entsteht

Am Beispiel UC-08, eine eigene Stelle aus Text oder Screenshot speichern:

1. **Zeile im Plan.** Der Plan nennt Ergebnis und Stufe, was die Eval später prüft, und schätzt
   Modell und Effort (Haiku 5.5, `medium`).
2. **Prompt-Blatt.** Ein Schreiber-Agent füllt die zwölf Schritte des Prompt-Leitfadens, ein
   Prüfer-Agent meldet Funde gegen den Leitfaden, eine Runde Überarbeitung, dann Pause. Offene
   Punkte entscheidet der Autor, etwa ob das Modell für eine Anzeige ohne Firmennamen raten darf
   (nein).
3. **Code der Unit.** Der Schreiber setzt das Blatt in [job_extract.ts](../backend/src/prompts/job_extract.ts)
   um, der Prüfer vergleicht Blatt und Code Wort für Wort.
4. **Use Case.** Claude Code schreibt Kontext, Backend, Frontend und Tests, dann fordert es das
   Review an. glm-5.3 auf z.ai prüft gegen die Anforderung, die Projektregeln und das Design und
   antwortet mit nummerierten Funden.
5. **Fixes und Abschluss.** Jeder Fund wird am Code geprüft, behoben oder mit Grund abgelehnt;
   Re-Review; der Autor liest die Tabelle, sieht den Diff und committet.

## Entscheidungen, die vorher getroffen wurden

- **Zwei Phasen.** Erst alle Use Cases mit geschätztem Modell, dann Unit für Unit messen. Grund:
  Schätzen ist billig, Messen kostet Budget; eine Messung an einer halb fertigen App misst das
  Falsche.
- **Budget.** 100 $ API-Budget für das ganze Projekt, 25 $ davon für Evals. Judge und Reviewer
  laufen deshalb auf z.ai mit Pauschale, Beispiele schreibt Claude Code aus dem Abo.
- **Caching nur bei häufigem Lesen.** Der Lebenslauf-Upload bekommt kein `cache_control`, weil der
  Prefix nur einmal gelesen wird; ob der Coach es bekommt, entscheidet eine Messung in Phase B.
- **Kein Modell bewertet die eigene Arbeit.** Gilt für Prompts (Opus schreibt, Fable prüft), für
  Beispiele (Claude schreibt, glm prüft) und für Code (Claude schreibt, glm prüft).
- **Was gelten muss, prüft der Code.** Der Prompt bittet; Zod, Enum und Längenprüfung erzwingen.
  Jeder Kopfkommentar einer Unit trennt „Enforced in code“ von „Requested only“.
- **Die niedrigste Stufe, die die Aufgabe löst.** Die Treppe heißt: Formular und Code, ein
  Modellaufruf, Modell mit Werkzeug, Workflow, Agent. Jede Funktion bekommt die unterste Stufe, die
  sie löst, und jede Unit das billigste Modell, das ihre Eval besteht. Beispiel Coach (UC-11):
  Stelle speichern und Status setzen gibt es schon als Formular (UC-08, UC-10), sie bleiben Code.
  Der Coach bekommt nur lesende Werkzeuge, die Bewerbung lesen und die Websuche, weil nur dort das
  Modell etwas kann, was Code nicht kann: Interviewfragen aus Anzeige und Lücken schreiben und eine
  Firma recherchieren, bei der die Zahl der Suchen vorher offen ist. Schreibende Werkzeuge im Chat
  hätten die Oberfläche verdoppelt und das größte Risiko gebracht: eine Anweisung in einer Anzeige
  oder Webseite hätte Daten der Person ändern können.
- **Workflow statt Agent beim Interview-Training (UC-12).** Entschieden vor dem Bau. Der Weg steht
  fest: Stelle und Schwierigkeit wählen, Frage, schriftliche Antwort, Note mit Feedback, nächste
  Frage, am Ende der Bericht. An der Checkliste nach Barry Zhang (Anthropic) scheitert der Agent
  schon bei der ersten Frage, denn der Ablauf lässt sich als Entscheidungsbaum aufmalen. Eine
  Schleife brächte nur zusätzliche Aufrufe, und die Note muss vorhersagbar sein, weil die Eval
  Bänder und Reihenfolge prüft. Deshalb bestimmt der Code die Schritte und ruft drei Units ohne
  Werkzeuge: `interview_question`, `interview_grade`, `interview_report`. Stelle, Match und frühere
  Fragen lädt der Code nach `userId` und legt sie als Daten in den Prompt. Pausieren und Fortsetzen
  folgt aus der Datenbank: Status der Session und gespeicherte Runden zeigen, was als Nächstes
  kommt. Der Coach (UC-11) ist der Gegenfall: Dort ist offen, welche Bewerbung gemeint ist und wie
  viele Suchen nötig sind, deshalb ein Agent.

## Was noch nicht gebaut ist

- **Stufe 1 bis 5 sind gebaut** (UC-01 bis UC-12), zuletzt das Interview-Training als Workflow
  mit `interview_question`, `interview_grade` und `interview_report`.
- **Go-live fehlt:** Registrieren und Konto (UC-13). Geplant und noch nicht Code.
- **Phase B ist nicht begonnen.** Die Eval-Infrastruktur (`run`, `check`, `review`, Batch) existiert;
  Beispielfälle und Läufe wurden am 19. Oktober gelöscht, um in Phase B sauber zu starten. Die
  Modellwahl je Unit ist bis dahin eine begründete Schätzung, keine Messung.

## Leseweg für 15 Minuten

1. [job_extract.ts](../backend/src/prompts/job_extract.ts): eine Prompt-Unit von oben nach unten –
   Konstanten, Schema, Prompt-Teile, Request-Funktion.
2. [assemble.ts](../backend/src/llm/assemble.ts): wie aus den Teilen die Anfrage im Budget wird.
3. [send.ts](../backend/src/llm/send.ts) und [costs.ts](../backend/src/llm/costs.ts): Senden,
   Streaming, Kosten.
4. [coach.service.ts](../backend/src/modules/coach/coach.service.ts): die Agent-Schleife mit
   lesenden Werkzeugen und Stop-Gründen.
5. [checks.ts](../backend/evals/checks.ts): die Eval-Prüfungen als Code.
6. [app.ts](../backend/src/app.ts): wie alles zusammengesteckt wird.
