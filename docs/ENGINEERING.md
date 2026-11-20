# Was dieses Projekt zeigt

Stand: 19. November 2026

Die App selbst ist absichtlich gewöhnlich: Login, Chat, Datei-Upload, Listen, Formulare. Das
Besondere liegt darin, **wie jeder Modellaufruf entworfen, abgesichert und gemessen wird** und wie
das Projekt mit Claude Code als Werkzeug gebaut wird, ohne dass der Code zu Vibe-Coding wird.

Diese Seite ist für eine Person, die das Repo in zehn Minuten beurteilen will. Jede Behauptung steht
mit der Datei, in der man sie prüfen kann. Was bewusst nicht gebaut ist, steht am Ende.

## Wer macht was

Claude Code schreibt den meisten Code; deshalb steht es als Co-Autor in jedem Commit. Die
Entscheidungen davor und danach trifft der Autor:

- **Die Methode.** Interne Leitfäden legen fest, wie ein Prompt geschrieben wird, destilliert aus
  Berryman/Ziegler, _Prompt Engineering for LLMs_ (O'Reilly 2025), und wie ein Agent
  gebaut wird, nach Kyle Stratis, _AI Agents with MCP_ (O'Reilly 2026), jeweils mit
  angenommenen und abgelehnten Konzepten. Ebenso entstanden der Leitfaden für die Suche mit RAG nach
  Mendelevitch/Bao, _Hands-On RAG for Production_ (O'Reilly), und der Leitfaden für Evals nach
  Shankar/Husain, _Evals for AI Engineers_ (O'Reilly 2027).
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
| Jede Anfrage entsteht an einer Stelle | [cv_analysis.request.ts](../backend/src/prompts/cv_analysis/cv_analysis.request.ts), Funktion `cvAnalysisRequest` | eine Funktion je Unit baut die vollständige Anfrage; der Service ruft sie, Modell und Effort lassen sich über eine `Variant` tauschen |
| Der Prompt bleibt klein | [coach_agent.config.ts](../backend/src/prompts/coach_agent/coach_agent.config.ts), [coach_agent.request.ts](../backend/src/prompts/coach_agent/coach_agent.request.ts) | jede Unit baut die Anfrage direkt aus ihren Konstanten; was wachsen kann, hat eine feste Grenze: der Verlauf des Coachs 60.000 Zeichen, 50 Bewerbungen, 3 Recherchen, der Lebenslauf 5 Seiten |
| Structured Outputs ohne doppeltes Schema | [job_extract.schemas.ts](../backend/src/prompts/job_extract/job_extract.schemas.ts), `jobExtractSchema` | ein Zod-Schema validiert die Antwort, `z.toJSONSchema()` daraus geht als `output_config.format` an die API |
| Prompt-Injection wird strukturell behandelt, nicht mit Verboten | [job_extract/](../backend/src/prompts/job_extract/), `markedText`, `jobPrompt.FOREIGN` und `jobExtractResult` | eingefügter Text geht als Document-Block und zusätzlich zwischen zwei Tags mit einer Kennung, die bei jedem Aufruf neu zufällig gewählt wird und die der Text nicht kennen kann; der Absatz zum fremden Material erklärt Anweisungen im Material zum Material; was gelten muss, prüft der Code: Zod, Wortlaut, Adressen und unsichtbare Zeichen in `jobExtractResult` |
| Modellwahl ist ein Kosten-Latenz-Qualität-Trade-off | [prompts/](../backend/src/prompts/) | Modell und Effort je Unit als Konstante: Haiku für Extraktion und Fragen, Sonnet für Analyse und Bewertung; Opus nirgends |
| Kosten werden je Aufruf gemessen, mit Cache | [costs.ts](../backend/src/llm/costs.ts), [cvs.service.ts](../backend/src/modules/cvs/cvs.service.ts) | Preistabelle mit Cache-Read und Cache-Write, Batch-Rabatt; Tokens und Kosten werden am Datensatz gespeichert |
| Claude-API-Funktionen dort, wo sie fachlich passen | [send.ts](../backend/src/llm/send.ts), [cvs.service.ts](../backend/src/modules/cvs/cvs.service.ts), [cv_analysis.request.ts](../backend/src/prompts/cv_analysis/cv_analysis.request.ts) | Streaming mit Abbruch und Teilantwort; die Lebenslauf-Analyse als direkter Aufruf mit Zeitlimit statt als Batch, weil Stellen, Match und Coach auf das Ergebnis warten; PDF als Document-Block; Screenshot als Image-Block; adaptives Thinking mit Effort |
| Jeder Stop-Grund hat eine Behandlung | [coach.service.ts](../backend/src/modules/coach/coach.service.ts) | `refusal` wird geloggt und nicht gespeichert, leere Antwort nicht gespeichert – außer an der Grenze der Fortsetzungen (`pause_turn`), damit Schrittzeilen und der Hinweis der App bleiben –, unbekannter Grund wirft einen Fehler |
| Backend-Architektur, die sich testen lässt | [app.ts](../backend/src/app.ts) | ein Composition Root, Module je Domäne, Services mit Abhängigkeiten im Konstruktor, feste Fehlerabbildung; 432 Vitest-Fälle im Backend mit Supertest gegen eine eigene Testdatenbank und eine eigene ChromaDB, 99 im Frontend mit `@vue/test-utils` |
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

- **Erst schätzen, dann an einer Unit messen.** Alle Use Cases laufen mit geschätztem Modell und
  Effort je Unit. Gemessen wird nur `cv_analysis`, weil Suche, Match und Coach auf ihrer
  gespeicherten Analyse aufbauen; der Weg steht unten unter „Die Eval von `cv_analysis`“.
- **Budget.** Reviewer und Prüfer der Eval laufen auf Codex mit dem ChatGPT-Abo, damit das
  API-Budget für die App bleibt; ein Lauf der Eval kostet rund 0,09 $.
- **Caching nur bei häufigem Lesen.** Der Lebenslauf-Upload bekommt kein `cache_control`, weil der
  Prefix nur einmal gelesen wird.
- **Kein Modell bewertet die eigene Arbeit.** Gilt für Prompts (Opus schreibt, Codex prüft), für
  Beispiele (Claude schreibt, Codex prüft) und für Code (Claude schreibt, Codex prüft).
- **Was gelten muss, prüft der Code.** Der Prompt bittet; Zod, Enum und Längenprüfung erzwingen.
  Jeder Kopfkommentar einer Unit trennt „Enforced in code“ von „Requested only“.
- **Die niedrigste Stufe, die die Aufgabe löst.** Die Treppe heißt: Formular und Code, ein
  Modellaufruf, Modell mit Werkzeug, Workflow, Agent. Jede Funktion bekommt die unterste Stufe, die
  sie löst, und jede Unit das billigste Modell, das nach Einschätzung reicht. Beispiel Coach (UC-11):
  Stelle speichern und Status setzen gibt es schon als Formular (UC-08, UC-10), sie bleiben Code.
  Der Coach bekommt nur ein lesendes Werkzeug, die Bewerbung lesen, weil nur dort das Modell etwas
  kann, was Code nicht kann: Interviewfragen aus Anzeige und Lücken schreiben. Die Firmenrecherche
  läuft als eigene Unit `company_research` mit der Websuche, weil die Zahl der Suchen vorher offen
  ist; die Person startet sie per Formular, und die Unit bekommt keine privaten Daten. Schreibende
  Werkzeuge im Chat hätten die Oberfläche verdoppelt und das größte Risiko gebracht: eine Anweisung
  in einer Anzeige oder Webseite hätte Daten der Person ändern können.
- **Fachwissen prüft die Theorie, Daten entscheiden.** Das RAG-Blatt der Stellen-Vorauswahl (UC-14)
  begründete, warum eine hybride Suche aus Vektor und Wortsuche (BM25) wenig bringt: Lebenslauf und
  Anzeige stehen oft in verschiedenen Sprachen. Aus der eigenen Jobsuche wusste der Autor, dass
  Skills wie „PHP“ oder „Vue.js“ in jeder Sprache gleich geschrieben werden. Ein schneller, nur
  lesender Vergleich mit dem eigenen Lebenslauf über 1.576 Stellen: 5 von 20 Treffern ändern sich,
  mit einem echten Gewinn (eine passende Laravel-Stelle rückt von Vektor-Rang 91 nach vorn) und einem
  Fehlgriff (eine Cloud-QA-Stelle, nur weil in Wörter zerlegte Skills wie „test“ und „api“ trafen).
  Ohne Prüfbestand bleibt die Suche rein semantisch.

## Die Eval von `cv_analysis`

Die Lebenslauf-Analyse ist der wichtigste Modellaufruf: Rolle, Match, Coach und Suche bauen auf
ihrem gespeicherten Ergebnis auf. Deshalb wird sie gemessen, und zwar in einer festen Reihenfolge:
**erst den Prompt genauer machen, dann messen, ob es wirkt, erst danach Effort oder Modell ändern.**
Ein teureres Modell ist die letzte Stufe, nicht die erste.

**Aufbau.** 20 erfundene Fälle als PDF, verteilt über vier Dimensionen (Art des Dokuments,
Werdegang, Form des PDF, fremder Text mit versteckten Anweisungen), darunter ein Anschreiben ohne
Lebenslauf, ein Zeugnis, ein französischer Lebenslauf und neun Angriffe. Die Texte schrieb ein
Modell einer anderen Familie (Gemini), damit Claude keinen Heimvorteil hat. Die Eval ruft dieselbe
Request-Funktion wie die App ([cv_analysis.request.ts](../backend/src/prompts/cv_analysis/cv_analysis.request.ts))
und zeichnet jede Antwort ganz auf. Jede Runde läuft dreimal über alle Fälle, damit sich ein
zufälliger von einem festen Fehler unterscheiden lässt.

**Wer urteilt.** Codex (GPT-6) liest jede der 60 Antworten gegen den Fall und die Regeln der Unit
und zählt jede Fehlerart. Der Autor entscheidet je Fehlerart: Sagt der Prompt die Regel nicht
(Spezifikationsfehler), wird er genauer; sagt er sie und das Modell folgt trotzdem nicht
(Generalisierungsfehler), kommen stärkere Mittel. Grenze: Das Urteil über jede Antwort kommt von
einem Modell, nicht von einem Menschen.

| Runde | Änderung | Ergebnis (Antworten mit Fehler, von 60) | Kosten |
| --- | --- | --- | --- |
| 1 | Ausgangsstand, Haiku 5.5, Effort `medium` | 9 von 60 annehmbar; häufigste Fehler: Einschätzung ohne Beleg 27, vorhandene Angabe als fehlend 25, Kenntnisse falsch geschnitten 23, Ort im Feld Arbeitgeber 19; Anschreiben allein in 3 von 3 Läufen als Lebenslauf angenommen | 0,25 $ |
| 2 | Prompt: fünf Spezifikationsfehler als Regeln (Arbeitgeber nur der Name, nur erworbene Abschlüsse, Anschreiben allein ist kein Lebenslauf, Beförderung, internes Projekt keine Station) | Ort im Arbeitgeber 19 → 0, Vertragszusatz 3 → 0, Anschreiben 3 → 0, Beförderung 2 → 0, internes Projekt 2 → 0; die großen Lesefehler blieben (27 → 29, 25 → 21); 11 von 60 annehmbar | 0,27 $ |
| 3 | Kein neuer Prompt, Effort `high` statt `medium` bei Haiku 5.5 | gemischt: Kenntnisse falsch geschnitten 18 → 10, Abschlussmonat verloren 8 → 3; aber Einschätzung ohne Beleg 29 → 38, vorhandene Angabe als fehlend 21 → 27, unbelegter Wert in einem Feld 3 → 10; 11 von 60 annehmbar wie in Runde 2 | 0,36 $ (+36 %) |
| 4 | Kein neuer Prompt, Sonnet 5.5 mit Effort `low` statt Haiku 5.5 `medium` | kein Gewinn: Einschätzung ohne Beleg 29 → 37, vorhandene Angabe als fehlend 21 → 31, Abschlussmonat verloren 8 → 27, Teilnahme als Abschluss 6 → 10; schneller (rund 4 statt 8 Minuten je Lauf); 13 von 60 annehmbar | 2,67 $ (rund zehnmal Haiku) |
| 5 | Prompt aus Runde 2 auf Haiku 5.5 `medium`, dazu eine Regel für die Einschätzung (Zahlen, Umfang, Einschränkung und Stufe der Tätigkeit so, wie die Stelle sie nennt; vor „fehlt“ den ganzen Lebenslauf durchsehen) | ohne Wirkung: Einschätzung ohne Beleg 29 → 31, vorhandene Angabe als fehlend 21 → 20; 10 von 60 annehmbar; Regel zurückgenommen | 0,31 $ |
| 6 | Few-Shot statt der Regel: drei kleine, erfundene Beispiele (eine Zeile aus einem Lebenslauf und der passende Eintrag), ausdrücklich gekennzeichnet | ohne Wirkung: 29 → 25 und 21 → 27; kein Detail aus den Beispielen in den Antworten; 10 von 60 annehmbar; Beispiele zurückgenommen | 0,28 $ |
| 7 | Zitat je Eintrag nach der Claude-Doku („Reduce hallucinations“): Stärken, Schwächen und Tipps schreiben zuerst den Wortlaut der Stelle (`quote`), dann den Eintrag; gespeichert wird nur der Eintrag | ohne Wirkung: 29 → 25 und 21 → 23; alle 626 Zitate stehen im Lebenslauf, aber der Eintrag geht trotzdem darüber hinaus (aus „fachliche Leitung der QS für drei Teams“ wird „Leitung von drei Produktteams“); 28 % mehr Ausgabe; 9 von 60 annehmbar; Zitate zurückgenommen | 0,32 $ |

**Warum diese Reihenfolge.** Runde 2 zeigt den Unterschied der beiden Fehlerarten: Wo der Prompt
eine Regel nicht nannte, reichte eine Zeile, und der Fehler verschwand in allen drei Läufen. Die
großen Fehler (eine Stärke oder Schwäche behauptet mehr, als die Stelle belegt; eine Schwäche
nennt eine vorhandene Angabe als fehlend) stehen schon als Regel im Prompt; weitere Zeilen helfen
dort wenig. Deshalb kam als Nächstes mehr Denken (Effort `high`) im selben, günstigen Modell.
Runde 3 zeigt: Mehr Denken macht die Arbeit an festen Feldern genauer, aber die Einschätzung
eher ausführlicher und damit öfter unbelegt; insgesamt kein Gewinn für 36 % mehr Kosten. Runde 4
prüfte den letzten Hebel, ein größeres Modell: Sonnet 5.5 mit Effort `low` macht dieselben
Lesefehler, verliert öfter den Abschlussmonat und kostet rund zehnmal so viel je Analyse. Das
Ergebnis: Der Prompt aus Runde 2 hat gewirkt, Effort und Modell nicht. Für die Lebenslauf-Analyse
reicht das günstigste Modell.

**Runden 5 bis 7.** Für die beiden großen Lesefehler blieben drei Mittel am Prompt: eine
ausdrückliche Regel, Beispiele (Few-Shot) und ein wörtliches Zitat vor jedem Eintrag, wie es die
Claude-Doku gegen Halluzinationen empfiehlt (die Citations-Funktion der API geht nicht zusammen mit
Structured Outputs). Jedes lief eine Runde lang gegen Runde 2, mit einem
vorher festgelegten Ziel: beide Fehlerarten je unter 15 von 60. Keines hat es erreicht. Über alle
sieben Runden liegen die beiden Zahlen zwischen 20 und 38, egal ob Effort, Modell, Regel,
Beispiele oder Zitate; ein Teil der Schwankung kommt vom Judge, der nicht in jeder Runde gleich streng urteilt
(die fehlende Du-Anrede zählte er erst ab Runde 5, obwohl sie seit Runde 1 vorkommt). Runde 7 zeigt den Grund: Das Modell findet die
richtige Stelle und zitiert sie wörtlich, übertreibt aber beim Formulieren. Regel, Beispiele und
Zitate sind zurückgenommen, weil ein längerer Prompt oder eine längere Antwort ohne messbaren Gewinn
nur Tokens kostet.
Das Ergebnis: Haiku 5.5 mit Effort `medium` und dem Prompt aus Runde 2 bleibt. Dass Stärken,
Schwächen und Tipps manchmal mehr behaupten, als die Stelle belegt, oder eine vorhandene Angabe
als fehlend nennen, ist eine bekannte Grenze, und sie ist bewusst in Kauf genommen: Die
Einschätzung ist ein Rat für die Person auf der Lebenslauf-Seite und Hintergrund für Match-Analyse
und Coach. Stationen, Kenntnisse, Abschlüsse und Sprachen, auf denen Match-Analyse und Suche
aufbauen, kommen gleichbleibend und zu niedrigen Kosten. Bericht mit allen Urteilen:
[docs/evals/cv_analysis-auto.md](evals/cv_analysis-auto.md).

## Stand und Grenzen

Das Projekt ist abgeschlossen; weitere Use Cases sind nicht geplant.

- **Gebaut:** UC-01 bis UC-11 (Login, Coach-Chat, Lebenslauf, Stellen, Match-Analyse,
  Bewerbungen, Coach mit lesendem Werkzeug, Firmenrecherche per Websuche) und UC-14, die
  Stellen-Vorauswahl mit RAG: Lebenslauf und Stellen liegen als Vektoren in ChromaDB, eingebettet
  mit einem lokalen Modell über Ollama; die Liste „Passt zu dir“ zeigt die 20 ähnlichsten Stellen
  ohne Sprachmodell und wird bei jeder Änderung nachgeführt und mit PostgreSQL abgeglichen.
- **Alle Prompts sind neu geschrieben,** Unit für Unit nach dem Prompt-Leitfaden: `cv_analysis`,
  `job_extract`, `match_analysis`, `company_research`, `coach_agent`.
- **Gemessen ist nur `cv_analysis`** (siehe oben), in sieben Runden; die Einschätzung (Stärken,
  Schwächen, Tipps) geht in etwa jeder zweiten Analyse an mindestens einer Stelle über den Beleg
  hinaus, und kein Mittel am Prompt, an Effort oder Modell hat das gesenkt; das ist bewusst in Kauf genommen. Für `job_extract`, `match_analysis`,
  `company_research` und `coach_agent` sind Modell und Effort begründete Schätzungen; sie werden
  von Hand im Browser geprüft.
- **Die Güte der Suche ist nicht gemessen;** Reranking oder eine hybride Suche gibt es nicht.
- **Keine Registrierung;** Konten entstehen per Skript.

## Leseweg für 15 Minuten

1. [job_extract/](../backend/src/prompts/job_extract/): eine Prompt-Unit Datei für Datei –
   Konstanten, Schema, Prompt-Teile, Material, Prüfung der Antwort, Request-Funktion.
2. [coach_agent.request.ts](../backend/src/prompts/coach_agent/coach_agent.request.ts): wie aus Verlauf, Akte und Nachricht die Anfrage des Coachs wird.
3. [send.ts](../backend/src/llm/send.ts) und [costs.ts](../backend/src/llm/costs.ts): Senden,
   Streaming, Kosten.
4. [coach.service.ts](../backend/src/modules/coach/coach.service.ts): die Agent-Schleife mit
   lesenden Werkzeugen und Stop-Gründen.
5. [app.ts](../backend/src/app.ts): wie alles zusammengesteckt wird.
