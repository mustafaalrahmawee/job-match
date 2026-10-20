# Prompt-Blatt: coach_chat

- **Use Case:** UC-02 Chat mit dem Karriere-Coach, UC-03 Gespräche verwalten, Qualität und Effort wählen, UC-06 Den Coach zum eigenen Lebenslauf fragen
- **Modell und Effort:** Sonnet 5.5 (`claude-sonnet-5-5`), `medium` als Schätzung aus `EVAL_PLAN.md` §5; Effort Medium/High und Qualität Normal/Extended wählt die Person je Chat und schickt sie ausdrücklich mit
- **Status:** übernommen
- **Code:** `backend/src/prompts/coach_chat.ts`

Jeder Schritt folgt der Reihenfolge in `app-prompting-anchor.md` §6. Unter jedem Schritt stehen die Anker-Punkte, die er abdeckt. Im ausgefüllten Blatt bleibt kein Feld leer: Trifft ein Punkt nicht zu, steht dort `entfällt – <Grund>`. Nach der Übernahme werden die Prompt-Teile durch den Namen der Konstante im Code ersetzt; Analyse und Entscheidung bleiben.

## 1. Profil — AP-01, AP-05, AP-06, AP-19

Analyse:

- AP-01 Medium: niedrig wie Korrekturlesen – nur Text, der im Chatfenster getippt wird, kein Dokument und kein Bild, höchstens 10.000 Zeichen je Nachricht (`sendMessageSchema`), meist Deutsch, auch Englisch oder eine andere Sprache wie Arabisch. Abstraktion: mittel wie IT-Support – ein großes, offenes Feld (Anschreiben, Gehalt, Gespräch, Berufswechsel), aber begrenzt auf Bewerbung in Deutschland. Kontext: zwischen niedrig und mittel – mehr als beim Korrekturlesen, weil der Verlauf des Gesprächs und, ab Stufe 2, die gespeicherte Auswertung der aktiven Lebenslauf-Version mitgehen, weniger als beim IT-Support, weil kein Index durchsucht wird. Zustand: mittel wie IT-Support – der Verlauf liegt je Gespräch in der Datenbank und wird bei jeder Anfrage ganz mitgeschickt, die Auswertung ist gespeicherter App-Zustand; verworfene Zweige wie bei der Reiseplanung gibt es nicht.
- AP-05 Oberfläche: Die Antwort wird gestreamt und im Coach-Chat durch `MarkdownText.vue` mit `marked` und `DOMPurify` als Markdown dargestellt; der Rückweg zur Person ist also gerendertes Markdown in einem Chatfenster mit höchstens 768 px Breite.
- AP-06 Modell und Kosten: Modell und Effort kommen aus der Schätztabelle, nicht aus dieser Unit; geschätzt 0,006 $ je Anfrage. Die Person kann Effort High und Qualität Extended wählen und kauft damit selbst mehr Tiefe gegen Wartezeit.
- AP-19 Dringlichkeit: mittel – die Person wartet vor dem Bildschirm und sieht den Stream, Sekunden bis zum ersten Token sind tragbar, Tastenanschlag-Latenz ist nicht gefordert. Vorbereitbar ist die Lebenslauf-Auswertung: Sie entsteht einmal beim Hochladen (UC-04), zur Anfragezeit wird sie nur gelesen und in Text umgesetzt.

Entscheidung: Profil wie analysiert. Es steht im Kopfkommentar über der Unit, dem einen Kommentar, den der Code trägt, im Aufbau wie `cv_analysis.ts`: Archetyp und Laufzeitform (Schritt 2), Profil mit Medium, Abstraktion, Kontext und Zustand, Oberfläche, Dringlichkeit, Modell und Effort, die Slots mit Klasse und Grenze (Schritt 5), der Stop (Schritt 9) und die Durchsetzungslinie (Schritt 10). Modell `claude-sonnet-5-5` als Konstante aus der Schätztabelle. Dringlichkeit mittel erlaubt eingebautes Denken nur, wenn die Person Extended wählt (Schritt 8).

Prompt-Teil: → Kopfkommentar, `COACH_CHAT_MODEL`

## 2. Archetyp und Laufzeitform — AP-30, §2

Analyse:

- AP-30: Die Antwort geht direkt an die Person, über mehrere Runden, und wird nicht geparst; das ist eine Beratung im Gespräch. Ein Bericht oder ein strukturiertes Dokument passt nicht, weil die Person frei fragt und die Antwort Prosa ist.
- §2 Laufzeitform: ein System-Teil plus ein verwalteter Verlauf, also Mehrrunden-Chat. Die Lebenslauf-Auswertung kommt nicht aus einem Index, sondern aus dem gespeicherten Zustand der Person, deshalb ist es kein retrieval-gestützter Zug. Tools kommen erst mit UC-11 (Stufe 4) in der eigenen Unit `coach_agent`.

Entscheidung: Beratung im Gespräch (advice conversation), Laufzeitform Mehrrunden-Chat (multi-turn chat), ohne Tools und ohne Retrieval.

Prompt-Teil: → `COACH_CHAT_FRAME`, Kopfkommentar (erste Zeile)

## 3. Frame — AP-02, AP-03, AP-14, AP-31

Analyse:

- AP-02: Ein Chatverlauf zwischen einer ratsuchenden Person und einer Beraterin ist ein Dokumenttyp, den das Modell oft gesehen hat; die Chat-API liefert die Form des Transkripts. Der Systemtext ist in sauberem, sachlichem Deutsch geschrieben, weil sich sein Ton auf die Antwort überträgt.
- AP-03: Der erste Satz nennt den Chat in job-match, die Person, die sich in Deutschland bewirbt, und den Karriere-Coach in der dritten Person und sagt, dass der Coach auf die letzte Nachricht antwortet; damit tragen Frame und nicht ein Rollenlabel die Persona.
- AP-14: Der Prompt enthält keine Geheimnisse – weder Schlüssel noch interne Daten anderer Personen –, er darf also ohne Schaden sichtbar werden. Ein Satz zur Geheimhaltung entfällt; die Bitte, den Systemtext auszugeben, fällt unter den Umfang wie jede andere Bitte.
- AP-31: Die Evals verlangen, dass eine themenfremde Bitte abgelehnt wird und ein Versuch, den Systemtext zu überschreiben, wirkungslos bleibt. Beides fasst ein Umfangssatz mit einer festen Reaktion statt eines Verbots: Eine neue Aufgabe für den Coach liegt außerhalb des Umfangs wie jede andere themenfremde Bitte. Wünsche zu Form und Sprache der Antwort – kürzer, auf Englisch, nur Stichpunkte – liegen nicht außerhalb des Umfangs; für sie gelten die Regeln in Schritt 4, damit gleich gelagerte Wünsche gleich behandelt werden.
- Umfang: Der Hinweistext im leeren Chat (`CoachView.vue:24`) nennt vier Beispiele („Anschreiben, Lebenslauf, Vorstellungsgespräch oder Gehaltsverhandlung“). Der Umfang im Prompt ist weiter und nimmt Stellensuche, Berufswechsel und den Arbeitsmarkt in Deutschland hinzu, weil job-match Stellen sucht und abgleicht (Stufe 3) und solche Fragen im Gespräch über eine Bewerbung natürlich aufkommen; ein Umfang nur aus den vier Beispielen ließe den Coach etwa „Wo finde ich Backend-Stellen?“ ablehnen. Der Umfang legt fest, welche Eval-Fälle `declines_scope` tragen, und ist eine Produktentscheidung.

Entscheidung: Drei Sätze: Frame, Umfang, Umgang mit Bitten außerhalb des Umfangs, auch wenn sie als neue Aufgabe für den Coach formuliert sind. Der Umfang ist weiter als der Hinweistext im leeren Chat; die Person hat ihn bestätigt. Den Hinweistext in `CoachView.vue` zieht sie später nach, außerhalb dieser Unit (Offene Punkte). Der Text ist die Konstante `COACH_CHAT_FRAME` und bildet den Anfang von `COACH_CHAT_SYSTEM`, weil die Tests diesen Namen für den festen Teil erwarten.

Prompt-Teil: → `COACH_CHAT_FRAME`

## 4. Conduct Rules — AP-07 bis AP-13

Analyse:

- AP-07: Gleich gelagerte Fragen sollen gleich behandelt werden: Sprache, Länge, Aufbau und der Umgang mit fehlenden Angaben müssen über Läufe stabil sein, weil die Eval genau das prüft (Sprache, `max_words`, kein erfundener Lebenslauf).
- AP-08: Jede Regel wird als Positiv mit „damit“ oder „weil“ geschrieben; strukturelle Absolute gibt es nicht, weil keine Form maschinell geprüft wird.
- AP-09: Vier Absätze tragen die Last: Sprache und Anrede, Antwort zuerst und Länge, Wissensstand und fehlende Angaben, Markdown. Mehr Regeln würden mit dem Verlauf um Aufmerksamkeit konkurrieren.
- AP-10: Alle Regeln stehen im System-Teil; der Verlauf und die Lebenslauf-Auswertung sind die dynamischen Teile.
- AP-11: Die Person liest im schmalen Chatfenster; die direkte Antwort oder der nächste Schritt steht vorn, die Begründung danach.
- AP-12: Der Coach sieht nur den Chat und gegebenenfalls die Auswertung, nicht die Stellen oder Bewerbungen der Person. Das muss gesagt werden, sonst füllt das Modell Lücken; bei einer tragenden Lücke fragt er gezielt nach, bei einer Randlücke nennt er seine Annahme. Gehaltszahlen sind die naheliegendste Erfindung und bekommen deshalb eine eigene Regel.
- AP-13: Die Oberfläche ist deutsch, die Eval prüft aber Englisch und Arabisch; die Antwort folgt der Sprache der letzten Nachricht. Die App duzt die Person (Screens UC-02/UC-06, Texte im Frontend), deshalb duzt auch der Coach auf Deutsch.
- Länge: Die Schätztabelle verlangt eine Längengrenze. Die Antwort im Screen UC-06 hat rund 120 Wörter; ein deutsches Anschreiben füllt eine Seite mit rund 300 bis 400 Wörtern.

Entscheidung: Eine Antwort bleibt unter etwa 250 Wörtern; ein ausdrücklich gewünschter ganzer Text wie ein Anschreiben darf bis etwa 400 Wörter haben. Die Person hat beide Zahlen bestätigt; `max_words` im `gold.json` der Eval folgt ihnen. Sobald die Stellenanzeige bekannt ist, darf der Coach ein ganzes Anschreiben im Chat schreiben; das gilt bis UC-15 (Stufe 8), mit UC-15 entscheidet die Person neu. Für das Anschreiben ohne Stellenanzeige gilt die Regel zur tragenden Lücke: Der Coach fragt nach der Anzeige. Der Text ist die Konstante `COACH_CHAT_RULES` und bildet den zweiten Teil von `COACH_CHAT_SYSTEM`.

Prompt-Teil: → `COACH_CHAT_RULES`

## 5. Context Slots — AP-15 bis AP-18, AP-20, AP-23 bis AP-27

Analyse:

- AP-15 statisch und dynamisch: Statisch sind Frame, Regeln, der Text ohne Lebenslauf, die Regeln zum Lebenslauf und der Refocus. Dynamisch sind der Verlauf mit der letzten Nachricht, die Lebenslauf-Auswertung und der heutige Tag; Qualität und Effort sind Anfrageparameter, kein Text.
- AP-16 Klassen: Die letzte Nachricht ist direkt; frühere Züge und die Auswertung sind indirekt; der Text ohne Lebenslauf und die Regeln zum Lebenslauf sind Boilerplate, die die Auswertung in den Systemtext einbindet.
- AP-17 Feedforward: Abrufen ist `cvs.readyAnalysis(userId)` (nur die aktive Version derselben Person mit Status `ready`) und das Laden des Gesprächs; Snippetizing ist `cvAside()`, das das JSON der Auswertung in beschriftete deutsche Listen umsetzt und `is_cv` und `language` weglässt; Bewerten entfällt, weil es nur ein Snippet gibt; Zusammenbauen ist `coachChatRequest()`.
- AP-18: Jede Rubrik der Auswertung trägt Fragen aus UC-06 (Rolle, Stationen, Kenntnisse, Ausbildung, Sprachen, Stärken, Schwächen, Tipps); die Auswertung geht auch bei Fragen ohne Lebenslauf-Bezug mit, weil fast jeder Bewerbungsrat vom Werdegang abhängt und sie durch `CV_LIST_LIMITS` klein bleibt.
- AP-20: Nah und stabil sind der gespeicherte Verlauf und die Auswertung (langsam veränderlich); weiter weg liegen gespeicherte Stellen und Bewerbungen, die erst mit den Tools in UC-11 erreichbar werden. Umgesetzt sind nur die beiden nahen Quellen.
- AP-23: Die Auswertung steht in einem markierten Aside `<lebenslauf quelle="…">` mit Endmarke, je Rubrik eine Überschrift mit Liste; leere Rubriken zeigen „keine Angabe“, damit das Modell eine Lücke als Lücke liest. Das Datum der Auswertung, das ins Aside gehört, liefert `cvs.readyAnalysis` nicht; das Aside nennt deshalb nur die Quelle (Offene Punkte). Weil die Inhalte aus einem hochgeladenen Dokument stammen, sagt der Boilerplate-Text nach dem Aside, dass sie als Daten gelesen werden.
- Heutiger Tag: Der Service übergibt als `asOf` das heutige Datum. Das ist für UC-06 nötig, weil „Wie viele Jahre habe ich gearbeitet?“ laufende Stationen („bis heute“) bis zu einem bekannten Tag rechnen muss. Der Tag ist App-Zustand und kein Merkmal der Auswertung; er steht deshalb nicht im Aside, sondern in einer eigenen beschrifteten Zeile davor („Heutiges Datum: …“, im ISO-Format wie die Daten der Stationen), damit das Modell ein Datum am Dokument nicht als Stand des Lebenslaufs liest.
- AP-24 Verlauf: Der Service schickt den ganzen gespeicherten Verlauf, älteste Züge zuerst, ohne Kürzung und ohne Zusammenfassung; die letzte Nachricht steht unten, aber nicht neben dem Refocus (Schritt 7). Eine Grenze fehlt bis UC-13 (Stufe 6); bis dahin ist das Kontextfenster mit dem Stop-Grund `model_context_window_exceeded` das Sicherheitsnetz.
- AP-25 entfällt – es gibt keinen Retrieval-Schritt mit Suchanfrage; die Auswertung wird über die Person gefunden, nicht über den Text der Frage.
- AP-26 entfällt als Zitierpflicht – kein Retrieval und keine Passagen-IDs, die die App prüfen könnte; die Bindung an die Auswertung wird stattdessen als Regel verlangt: der Coach nennt die Station oder Kenntnis, auf die er sich stützt.
- AP-27 entfällt – die Auswertung hat nur eine Länge, durch die Listengrenzen der Analyse begrenzt.

Entscheidung:

| Slot | statisch/dynamisch | Klasse | Quelle | Grenze |
| --- | --- | --- | --- | --- |
| letzte Nachricht | dynamisch | direkt | `messages`, letzter Eintrag | 1 bis 10.000 Zeichen (`sendMessageSchema`) |
| frühere Züge | dynamisch | indirekt | `Message` des Gesprächs, aufsteigend | keine bis UC-13; Kontextfenster als Netz |
| Lebenslauf-Auswertung | dynamisch | indirekt | `cvs.readyAnalysis(userId)` → `cvAside()` | `CV_LIST_LIMITS` der Analyse, eine Version |
| heutiger Tag | dynamisch | direkt (App-Zustand) | `asOf` aus dem Service, Zeile vor dem Aside in `cvAside()` | ein Datum, nur mit Auswertung (Offene Punkte) |
| Text ohne Lebenslauf | statisch | Boilerplate | `COACH_CHAT_NO_CV` | fest, nur ohne Auswertung |
| Regeln zum Lebenslauf | statisch | Boilerplate | `COACH_CHAT_CV_RULES` | fest, nur mit Auswertung |

Der Typ `CoachCv` bleibt, wie er im Gerüst steht. `cvAside()` setzt die Zeile `Heutiges Datum: <asOf>` vor das Aside und nimmt das Attribut `stand` aus dem Aside; sonst bleibt die Funktion wie im Gerüst. Die Tests prüfen, dass jede Angabe der Auswertung, das Datum und die vorgeschlagene Rolle ankommen. Die Regeln zum Lebenslauf nennen das Aside, sagen, dass eine Station mit „bis heute“ noch läuft, fassen den Inhalt als Daten und binden den Rat an die Auswertung; der Text ohne Lebenslauf sagt, dass keine Auswertung vorliegt und wohin die Person gehen kann.

Prompt-Teil: → `CoachCv`, `cvAside()`, `COACH_CHAT_NO_CV`, `COACH_CHAT_CV_RULES`

## 6. Anordnung — AP-21, AP-22, AP-28

Analyse:

- AP-21 Position: Der feste Systemtext steht vorn, damit er über alle Anfragen gleich bleibt (stabiles Präfix für UC-13); dahinter der Teil, der je Person und Tag wechselt. Bedeutung: Frame, Regeln und die letzte Nachricht werden nie gekürzt; der Verlauf ist das Einzige, was wachsen kann. Abhängigkeit: Die Regeln zum Lebenslauf setzen das Aside voraus, der Text ohne Lebenslauf schließt beide aus; die Tests verlangen genau diese Ausschließlichkeit. Eine Tokenzählung vor dem Senden fehlt bis UC-13.
- AP-22: In der Chat-API steht der Systemtext vor dem ganzen Verlauf, die letzte Nachricht ganz unten, die stärkste Stelle. Innerhalb des Systemtexts ist die Auswertung das Massengut; sie steht vor den Regeln zum Lebenslauf, sodass diese wie der Vertrag nach den Passagen im Retrieval-Skelett direkt vor dem Verlauf wirken.
- AP-28: Es gibt keine Bewertung und keine Kürzung; der minimale Crafter reiht die Teile in fester Folge und schickt den Verlauf vollständig.

Entscheidung: Zwei System-Blöcke: zuerst `COACH_CHAT_SYSTEM` (Frame und Regeln, fest), dann ein Block mit entweder Zeile mit dem heutigen Datum und Aside (beides aus `cvAside()`), Regeln zum Lebenslauf und Refocus oder Text ohne Lebenslauf und Refocus; danach der Verlauf, die letzte Nachricht zuletzt. Ein Cache-Breakpoint entfällt bis UC-13. Die Tests verlangen die drei Konstanten `COACH_CHAT_SYSTEM`, `COACH_CHAT_NO_CV` und `COACH_CHAT_CV_RULES` und prüfen nur, ob sie in der Anfrage enthalten sind; Frame und Regeln werden deshalb verbunden: `COACH_CHAT_SYSTEM` ist `COACH_CHAT_FRAME`, eine Leerzeile und `COACH_CHAT_RULES`. Die neue Konstante `COACH_CHAT_REFOCUS` und die Folge Aside vor Regeln zum Lebenslauf sind mit den Tests verträglich; das Gerüst stellt die Regeln zum Lebenslauf heute vor das Aside, bei der Assemblierung ändert sich `coachChatRequest` wie im Prompt-Teil unten.

Prompt-Teil: → `COACH_CHAT_SYSTEM`, `coachChatRequest()`

## 7. Refocus und Transition — AP-29

Analyse:

- AP-29 Einleitung: Frame und Regeln am Anfang des Systemtexts. Kontext: Auswertung im zweiten Block und der Verlauf. Refocus: Ein Refocus nach dem ganzen Kontext und neben der letzten Nachricht, wie AP-24 und das Retrieval-Skelett ihn vorsehen, entstünde, wenn `coachChatRequest` ihn als zweiten Textblock an die letzte Nachricht der Person hängt. Das gespeicherte Transkript bliebe dabei unberührt, weil `coach.service.ts` die `messages` erst zur Anfragezeit aus der Historie baut und nur die Antwort speichert. Dagegen steht `tests/coach/router.test.ts:131`: Der Test verlangt, dass die letzte Nachricht der Anfrage genau den Textblock der Person enthält, und legt damit die Form des Prompts fest. Dazu kommt: Ein Satz in der dritten Person im eigenen Zug der Person läse sich wie etwas, das sie selbst geschrieben hat, und die letzte Nachricht steht ohnehin an der stärksten Stelle. Deshalb nimmt der letzte Satz des Systemtexts die Aufgabe nach dem Lebenslauf-Material wieder auf; bei langen Gesprächen liegt der ganze Verlauf zwischen diesem Satz und der letzten Nachricht, die aber als stärkstes Element ganz unten steht. Die Messages API des SDK nimmt in `messages` auch Nachrichten mit der Rolle `system` an (Systemnachrichten mitten im Gespräch, dokumentiert für Erinnerungen je Zug); so ließe sich der Refocus neben den aktuellen Zug stellen, ohne den Text der Person anzufassen. Das ändert aber die Folge der Rollen, die der Router-Test prüft, und ist deshalb eine Option für Phase B.
- Transition: Die Chat-API eröffnet den Zug des Assistenten selbst; ein eigener Übergangstext ist nicht nötig.

Entscheidung: Ein Satz als Refocus, in beiden Fällen gleich (eigene Konstante `COACH_CHAT_REFOCUS`), am Ende des zweiten System-Blocks; `tests/coach/router.test.ts` bleibt unverändert. Die Person hat das entschieden: Ein Satz in der dritten Person im eigenen Zug der Person läse sich wie ihr eigener Text, und die letzte Nachricht steht bereits an der stärksten Stelle. Phase B prüft das mit langen Gesprächen; eine Systemnachricht in `messages` ist dort die Alternative (Offene Punkte). Transition durch die API.

Prompt-Teil: → `COACH_CHAT_REFOCUS`

## 8. Preamble und Reasoning — AP-34, AP-35, AP-39 bis AP-41, AP-45

Analyse:

- AP-34 Strukturelle Boilerplate: entfällt – die Antwort ist freie Prosa ohne festes Gerüst. Reasoning: Bei Fragen mit mehreren Bedingungen (Gehalt verhandeln, Berufswechsel, Lücke im Lebenslauf) hilft Nachdenken; das wählt die Person über die Qualität. Fluff: Höflichkeitsvorreden schieben die Antwort nach unten; die Regel „direkte Antwort zuerst“ (Schritt 4) drängt sie hinter die Antwort, ein Parser streift nichts ab.
- AP-35: Sonnet 5.5 hat eingebautes Denken; der Denkblock ist das Scratchpad, die Tiefe stellt der Effort-Parameter ein. `send.ts` streamt nur Text-Deltas, und der Controller zeigt nur Textblöcke, also bleibt das Denken verborgen. Ein Scratchpad-Abschnitt im Prompt entfällt.
- AP-39, AP-40: entfällt als Prompt-Text – das Denken läuft über den Denkblock, nicht über einen Gedankengang in der Antwort; ein Hinweis „Schritt für Schritt“ würde den Gedankengang in die sichtbare Antwort ziehen.
- AP-41: entfällt – ein Plan vor der Lösung lohnt sich bei Aufgaben mit vielen verzahnten Bedingungen; eine Chatantwort von höchstens etwa 400 Wörtern ist keine solche Aufgabe.
- AP-45: entfällt – eine Antwort aus einer Sicht reicht; mehrere Aufrufe kosten Zeit, auf die die Person wartet.

Entscheidung: Normal schickt `{ type: 'between_tools' }`. Laut der Thinking-Dokumentation von Anthropic lehnt Sonnet 5.5 `{ type: 'disabled' }` ab; `between_tools` ist seine niedrigste Stufe, schaltet das Denken vor der Antwort ab und wird nur bei Effort `high` oder darunter angenommen; ohne Tools enthält die Antwort nur Text. `COACH_CHAT_EFFORTS` (`medium`, `high`) liegt in dieser Grenze. `between_tools` nimmt nur Sonnet 5.5 an; Haiku 5.5 und die anderen Modelle antworten darauf mit Fehler 400, eine Eval-Variante mit anderem Modell braucht also einen anderen Wert für das Denken (Offene Punkte). Extended schickt `{ type: 'adaptive' }`, das Modell denkt so tief, wie die Frage es verlangt. Effort ist `medium` oder `high`, ausdrücklich je Nachricht mitgeschickt. Keine Reasoning-Anweisung im Prompt.

Prompt-Teil: → `COACH_CHAT_THINKING`, `COACH_CHAT_EFFORTS`, `Quality`, `Effort`, `ChatSettings`

## 9. Output Contract und Stop — AP-32, AP-33

Analyse:

- AP-32: entfällt – die Antwort wird nicht geparst, sondern als Markdown gezeigt; Format und Länge stehen als Regeln in Schritt 4.
- AP-33: Die Antwort ist fertig, wenn der Zug des Coaches endet: Stop-Grund `end_turn`, das natürliche Ende einer Chatnachricht. Der Controller setzt die Textblöcke zusammen; `COACH_CHAT_MAX_TOKENS` mit 8000 deckt Denkblock und Antwort und ist nur Sicherheitsnetz – eine Antwort von 400 Wörtern braucht rund 700 Tokens. Abbruch durch die Person ergibt `stopped` mit dem bisherigen Text.

Entscheidung: Ausgabe ist eine Markdown-Nachricht; Stop ist das Ende des Zugs (`end_turn`); der Parser liest alle Textblöcke und lässt Denkblöcke weg. 8000 Tokens bleiben als Obergrenze.

Prompt-Teil: → `COACH_CHAT_MAX_TOKENS`

## 10. Enforcement Line und Tools — AP-42, AP-44, AP-46 bis AP-49

Analyse:

- AP-42, AP-46, AP-47, AP-48: entfällt – die Unit hat keine Tools; sie kommen mit UC-11 in `coach_agent`.
- AP-44: entfällt – es gibt keine automatische Wiederholung mit Bewertung; „Erneut versuchen“ ist ein neuer Aufruf auf Wunsch der Person (`retry`) mit demselben Verlauf.
- AP-49: entfällt – die Unit löst keine Handlung aus; sie schreibt nur Text.
- Was der Prompt nur erbittet: Sprache, Länge, Umfang, Antwort zuerst, Bindung an die Auswertung, keine erfundenen Angaben. Das prüft in Phase B die Eval, nicht der Code zur Laufzeit.
- Was die App durchsetzt: Gespräche und Auswertung nur der eigenen Person (`userId`); Qualität und Effort per Zod-Enum; Nachricht 1 bis 10.000 Zeichen; Auswertung nur von der aktiven Version mit Status `ready`; Stop-Gründe – `refusal` wird protokolliert und nicht gespeichert, unbekannte Gründe sind ein Fehler, eine leere Antwort wird nicht gespeichert; Abbruch speichert den Teiltext als `stopped`; Markdown wird im Frontend mit DOMPurify bereinigt; Denkblöcke erreichen die Oberfläche nicht; `max_tokens` als Obergrenze.

Entscheidung: Durchsetzungslinie wie analysiert; sie steht als Zeile `Enforced in code:` im Kopfkommentar der Unit (Schritt 1). Keine Garantie im Prompt-Text, die der Code nicht hält.

Prompt-Teil: → Kopfkommentar (Zeile `Enforced in code:`)

## 11. Beispiele — AP-36 bis AP-38

Analyse:

- AP-36: Ton und Form einer Chatantwort in Markdown kennt das Modell; Frame und Regeln lassen keine Formfrage offen, die ein Beispiel klären müsste.
- AP-37: Ein Beispiel würde Länge, Ton und Themen der Antworten verankern und bei Arabisch oder Englisch eine deutsche Vorlage nachziehen; jede Beispielantwort konkurriert zudem mit Verlauf und Auswertung.
- AP-38: entfällt – ohne Beispiele keine Gegenmaßnahmen.

Entscheidung: Keine Beispiele.

Prompt-Teil: entfällt – Frame und Regeln lassen keine echte Mehrdeutigkeit, die ein Beispiel auflösen müsste.

## 12. Vier Kriterien am ganzen Prompt — AP-04

1. Ähnelt einem Trainingsdokument: ja – der Systemtext beschreibt in der dritten Person einen Beratungschat zwischen einer Person, die sich bewirbt, und einem Karriere-Coach, in sauberem, sachlichem Deutsch und in Prosa-Absätzen; die Chat-API macht aus `messages` das Transkript, in dem der Coach den nächsten Zug schreibt. Die Auswertung steht als beschriftete Listen in einem markierten Aside `<lebenslauf>` mit Endmarke, eine Form, die das Modell aus Dokumenten mit eingebetteten Daten kennt.
2. Alle nötigen Informationen enthalten: weitgehend – Umfang, Sprache, Anrede, Länge, Format, Umgang mit Lücken und Gehaltszahlen stehen im festen Teil; mit fertiger Auswertung kommen Zielrolle, Stationen, Kenntnisse, Ausbildung, Sprachen, Stärken, Schwächen, Tipps und der heutige Tag dazu, ohne sie der Satz, dass keine Auswertung vorliegt, und wohin die Person gehen kann. Was fehlt, ist benannt: das Datum der Auswertung (Offene Punkte, Schritt 5); Stellen und Bewerbungen der Person, die der Prompt ausdrücklich als unbekannt nennt; aktuelle Marktdaten, für die die Regel einen Richtwert mit Grundlage verlangt. Der heutige Tag kommt bisher nur mit Auswertung mit, ohne sie rechnet der Coach Zeiträume aus Angaben im Chat ohne bekanntes Datum; der Umbau, der das Datum in beide Zweige bringt, steht unter Offene Punkte (Heutiges Datum auch ohne Lebenslauf, Schritt 5).
3. Führt zur Lösung, nicht zu mehr Problem: ja – jede Antwort beginnt mit der direkten Antwort oder dem nächsten Schritt, eine Rückfrage nur bei einer tragenden Lücke und dann genau eine Angabe, Randlücken werden mit genannter Annahme überbrückt, Bitten außerhalb des Umfangs enden mit einem Vorschlag zur Bewerbung. Der Refocus schließt den Systemtext mit der Aufgabe; in langen Gesprächen liegt der Verlauf zwischen ihm und der letzten Nachricht, die dann allein an der stärksten Stelle steht (Offene Punkte, Schritt 7).
4. Natürliches Ende: ja – eine Chatnachricht des Coaches, die mit `end_turn` endet; die Längenregel (etwa 250 Wörter, ein gewünschter ganzer Text bis etwa 400) und das Angebot eines Folgeschritts geben der Antwort ein Ende vor dem Thema, `COACH_CHAT_MAX_TOKENS` mit 8000 ist nur Sicherheitsnetz.

## Offene Punkte

- **Hinweistext im leeren Chat (Schritt 3):** Der bestätigte Umfang ist weiter als die vier Themen in `CoachView.vue:24`. Nötig: den Hinweistext im Frontend nachziehen – außerhalb dieser Unit.
- **Datum der Auswertung im Aside (Schritt 5):** Das Aside soll das Datum seines Materials nennen; `cvs.readyAnalysis` liefert das Datum der Auswertung nicht, deshalb nennt das Aside nur die Quelle, und der heutige Tag (`asOf`) steht in einer eigenen Zeile davor. Der Screen UC-06 zeigt das Datum der Auswertung („vom 12. Okt.“). Nötig: `cvs.readyAnalysis` liefert es und der Service gibt es mit, dann trägt das Aside es als `stand` – außerhalb dieser Unit.
- **Heutiges Datum auch ohne Lebenslauf (Schritt 5):** Der heutige Tag ist App-Zustand, geht heute aber nur mit fertiger Auswertung mit, weil `asOf` in `CoachCv` steckt und nur `cvAside()` die Zeile schreibt; ohne Lebenslauf rechnet der Coach Zeiträume aus Angaben im Chat („seit 2019“) gegen ein unbekanntes Datum. Nötig: `asOf` wird ein eigener Parameter von `coachChatRequest`, die Zeile `Heutiges Datum: <asOf>` eröffnet den zweiten System-Block in beiden Zweigen, `CoachCv` verliert `asOf`; `coach.service.ts` sowie `tests/prompts/coach_chat.test.ts` und `tests/coach/router.test.ts` ziehen nach. Das berührt Dateien außerhalb dieser Unit und wird in `/review-loop` umgesetzt.
- **Refocus neben der letzten Nachricht (Schritt 7, Phase B):** Bei langen Gesprächen prüfen, ob der Refocus als Systemnachricht in `messages` vor dem aktuellen Zug wirkt; das ändert die Rollenfolge, die `tests/coach/router.test.ts` prüft.
- **Grenze des Verlaufs und Tokenzählung (Schritte 5 und 6):** Der Service schickt den ganzen Verlauf ohne Kürzung und ohne Zählung vor dem Senden; nur das Kontextfenster begrenzt. Das ist Aufgabe von UC-13 (Stufe 6, Kompaktierung, Zählung, Cache-Breakpoint auf `COACH_CHAT_SYSTEM`); bis dahin bewusst offen.
- **Denken in Eval-Varianten (Schritt 8, Phase B):** `between_tools` nimmt nur Sonnet 5.5 an; eine `Variant` mit anderem Modell braucht einen eigenen Wert für das Denken.

## Fassungen

| Fassung | Ergebnis | Fund aus der Eval | Schritt | Änderung |
| ------- | -------- | ----------------- | ------- | -------- |
