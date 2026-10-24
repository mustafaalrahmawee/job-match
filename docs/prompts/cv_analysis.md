# Prompt-Blatt: cv_analysis

- **Use Case:** UC-04 Lebenslauf als PDF hochladen (Deutsch oder Englisch); die gespeicherte Analyse ist die Grundlage für UC-06 (Lebenslauf-Abschnitt von `coach_agent`) und die späteren Units
- **Modell und Effort:** Haiku 5.5 (`claude-haiku-5-5`), Effort `medium` (Schätzung aus EVAL_PLAN §5: „extraction into a schema from a PDF, text layer or scan“, rund 0,001 $ je Aufruf)
- **Status:** übernommen
- **Code:** `backend/src/prompts/cv_analysis.ts`

Jeder Schritt folgt der Reihenfolge in `app-prompting-anchor.md` §6. Unter jedem Schritt stehen die Anker-Punkte, die er abdeckt. Im ausgefüllten Blatt bleibt kein Feld leer: Trifft ein Punkt nicht zu, steht dort `entfällt – <Grund>`. Nach der Übernahme werden die Prompt-Teile durch den Namen der Konstante im Code ersetzt; Analyse und Entscheidung bleiben.

## 1. Profil — AP-01, AP-05, AP-06, AP-19

Analyse:

- **AP-01 Medium:** mittel – das Problem kommt als PDF bis 5 MB (`CV_MAX_BYTES`, Prüfung auf `%PDF-` in `pdfSchema`), mit Textebene oder als Scan ohne Textebene, ein- oder zweispaltig, auf Deutsch oder Englisch. Die App wandelt nichts um: Das PDF geht als Document-Block an die API, die seine Seiten als Text und Bild liest. **Abstraktion:** mittel – das Übertragen von Stationen, Kenntnissen, Ausbildung und Sprachen ist niedrig wie Korrekturlesen, die Zielrolle aus der festen Liste und Stärken, Schwächen und Tipps verlangen aber Urteil über den ganzen Werdegang. **Kontext:** niedrig – alles steht im Dokument; dazu kommt nur die statische Rollenliste der App, kein Abruf. **Zustand:** keiner – ein Aufruf je Hochladen oder „Erneut versuchen“, ohne Verlauf; die App speichert das Ergebnis auf der Version, das Modell sieht nie ein früheres.
- **AP-05:** Die Oberfläche ist ein geparstes Objekt: Der Service liest den Text-Block, validiert ihn mit `cvAnalysisSchema` und speichert ihn auf `CvVersion.analysis`. Die Seite Lebenslauf (`CvView.vue`) zeigt die Felder als schlichte Listen und Schlagwörter per Interpolation, ohne Markdown; `cvAside` in dieser Unit schreibt sie für `coach_agent` und `match_analysis` in beschriftete Listen um; Stellen, Match und Training bauen später auf denselben Feldern auf. Der Rückweg ist also: JSON → Zod → Datenbank → Liste auf der Seite bzw. Kontext anderer Units.
- **AP-06:** Modell und Effort kommen aus der Schätztabelle (Haiku 5.5, `medium`); das kleinste Modell passt zu einer Übertragung in ein Schema, und die geringe Dringlichkeit lässt Zeit für eingebautes Nachdenken. Sichtbares Nachdenken als Text wäre im JSON nicht vorgesehen; Tiefe steuert der Effort.
- **AP-19:** Dringlichkeit niedrig – die Anfrage geht als Message Batch, die Seite zeigt „Wird analysiert … Das kann ein paar Minuten dauern“ und fragt alle 15 Sekunden nach. Die Analyse ist selbst die Vorbereitung für später: Sie entsteht einmal beim Hochladen, damit Coach, Match und Training das PDF nicht erneut senden.

Entscheidung: Die Unit ist eine Übertragung mit Urteil aus einem einzigen Dokument, ohne Zustand, Oberfläche geparstes Objekt, Dringlichkeit niedrig. Modell und Effort bleiben die vorhandenen Konstanten mit dem Wert der Schätztabelle; `Variant` erlaubt der Eval, beide zu überschreiben.

Prompt-Teil: → Kopfkommentar (Profile, Surface, Urgency, Model), `CV_ANALYSIS_MODEL`, `CV_ANALYSIS_EFFORT`, `Variant`

## 2. Archetyp und Laufzeitform — AP-30, §2

Analyse:

- **AP-30:** Die App parst die Antwort, validiert sie und speichert sie; kein Mensch liest das JSON selbst, sondern die Seite und andere Units lesen seine Felder. Das ist das strukturierte Dokument. Eine Beratung passt nicht, weil es keine Runden gibt; ein Bericht nicht, weil das Ergebnis Feld für Feld weiterverwendet wird. Stärken, Schwächen und Tipps sind kurze Texte innerhalb der Felder, kein eigener Bericht.
- **§2 Laufzeitform:** Ein Aufruf, eine Antwort: der Einzelaufruf. Dass er als Message Batch läuft, ändert nur den Versand, nicht die Unit; jede Anfrage im Batch ist unabhängig.

Entscheidung: Strukturiertes Dokument als einziger Archetyp, Laufzeitform Einzelaufruf, versendet als Message Batch, nach dem Skelett „Extraction sub-task“ in §7.

Prompt-Teil: → Kopfkommentar (erste Zeile, Prompt unit cv_analysis)

## 3. Frame — AP-02, AP-03, AP-14, AP-31

Analyse:

- **AP-02:** Ein Auswertungsbogen zu einem Lebenslauf, wie ihn Personalberatungen und Karriereberatungen zu Bewerberinnen und Bewerbern anlegen, ist ein häufiges Dokument: Profilfelder, dann eine kurze Einschätzung. Der Prompt ist in ruhiger, sachlicher deutscher Prosa geschrieben, weil Register und Ton in die Texte des Bogens übergehen. Der Frame spricht nur über den Bogen und das Dokument, nicht über die Anweisungen des Prompts.
- **AP-03:** Der erste Satz nennt das Dokument (Auswertungsbogen der Karriereberatung von job-match zu einem hochgeladenen Lebenslauf) und die Parteien (eine Person, die sich in Deutschland bewirbt, und eine Beraterin, die den Bogen ausfüllt) in der dritten Person. Einen Sprecherwechsel gibt es nicht; an seine Stelle tritt, was die Beraterin tut: übertragen und bewerten.
- **AP-14:** Der Prompt enthält nichts, was die Person nicht sehen dürfte: keine Schlüssel, keine Daten anderer Personen; das Dokument ist ihr eigenes. Ein Satz zur Geheimhaltung wäre keine Kontrolle und entfällt.
- **AP-31:** Der Umfang ist, was das Dokument selbst über den Werdegang sagt, dazu eine Zielrolle aus der festen Liste und eine Einschätzung für Bewerbungen in Deutschland; das wird als Umfang gesagt, nicht als Verbot. Das hochgeladene Dokument ist Material von außen: Text darin, der sich an den Leser oder an ein Programm richtet, gehört zum Material und ist keine Angabe über die Person. Das sagt der Frame positiv mit Grund, ohne einen bestimmten Wortlaut vorwegzunehmen. Wer den Bogen liest (die Person und die App), steht im Frame, damit klar ist, wofür die Felder dienen.

Entscheidung: Ein Frame aus vier Sätzen wird die Konstante `CV_ANALYSIS_FRAME`: Dokument und Parteien; der Umfang; das Dokument als Material samt Umgang mit Text, der sich an den Leser richtet; wer den Bogen liest und was darauf aufbaut. Keine Rollenzuschreibung („Du bist“), kein Geheimhaltungssatz, kein Verweis auf Regeln.

Prompt-Teil: → `CV_ANALYSIS_FRAME`

## 4. Conduct Rules — AP-07 bis AP-13

Analyse:

- **AP-07:** Gleiche Lebensläufe sollen gleich ausgewertet werden: Sprache der Texte, Schreibweise der übernommenen Angaben, der Umgang mit Fehlendem und die Form der Einschätzungen sind die Punkte, an denen die Eval-Szenarien (deutsch und englisch, Scan, zweispaltig, Lücke, Berufswechsel) schwanken würden. Jede Regel nennt das Verhalten, das sie festigt. Was je Feld gilt, steht im Ausgabevertrag (Schritt 9), nicht hier.
- **AP-08:** Jede Regel steht als Positiv mit „damit“ oder „weil“; keine Regel braucht ein Absolut, weil nichts davon im Code geprüft wird. Feste Höchstzahlen und das Schema gehören in den Ausgabevertrag und sind dort als von der App geprüft markiert.
- **AP-09:** Vor jeder Messung bleibt es bei fünf tragenden Regeln: Sprache und Anrede, Schreibweise übernommener Angaben, Bindung an das Dokument samt Umgang mit Fehlendem, Form der Einschätzungen, Format. Weitere Regeln kommen erst mit einem gemessenen Fehler.
- **AP-10:** Frame und Regeln sind statisch und stehen im System-Prompt; das Dokument ist dynamisch und steht im Nutzer-Turn. Der Ausgabevertrag ist ebenfalls statisch, steht aber nach dem Dokument im Nutzer-Turn, wie das §7-Skelett einer Extraktion und AP-22 ihn legen (Schritte 5 und 6).
- **AP-11:** Die Reihenfolge der Felder legt das Schema fest (Schritt 9). Innerhalb einer Stärke, Schwäche oder eines Tipps kommt der Befund zuerst und der Beleg danach, damit die Person in der Liste zuerst den Punkt liest; bei einem Tipp ist der Befund das, was die Person tun kann. Diese Reihenfolge steht allein in der Regel, nicht noch einmal im Ausgabevertrag, damit beide Teile nicht verschieden lesbar sind.
- **AP-12:** Lebensläufe lassen Angaben aus (Monate, Abschlussjahr, Sprachniveau), und ein Scan kann unleserlich sein. Weil Stellensuche, Match und Coach jedes Feld als Tatsache weiterverwenden, bleibt Fehlendes leer statt geschätzt; die Lücke selbst kann eine Schwäche sein. „Leer“ hat je Feld die Form, die das Schema zulässt: `null` in `start`, `end`, `year`, `level` und `highest_degree`; `employer`, `title`, `degree` und `institution` sind Pflicht-Strings, dort steht „nicht genannt“, damit die Station oder Ausbildung gezählt und die Lücke sichtbar bleibt. Lässt sich das Dokument kaum lesen, führte „bleibt leer“ allein zu einem fast leeren Bogen ohne Erklärung; deshalb nennt dann eine Schwäche den Grund und ein Tipp den Ausweg, eine PDF mit Textebene hochzuladen (Ausgabevertrag, Schritt 9).
- **AP-13:** Die App ist deutsch und duzt die Person; die Seite Lebenslauf und alle Units, die den Bogen lesen, sind deutsch. Deshalb sind die Einschätzungen auf Deutsch, auch zu einem englischen Lebenslauf, und Tipps duzen die Person wie im Screen `UC-04-05-Lebenslauf` („Nenne beim Redaktionssystem Zahlen …“). Mitwechseln mit der Person entfällt, weil sie in diesem Aufruf nicht schreibt. Übernommene Angaben bleiben in der Schreibweise des Lebenslaufs, damit die Person sie wiedererkennt und spätere Units sie im Wortlaut wiederfinden (die Match-Analyse prüft, dass jedes Zitat im Bogen oder in der Anzeige steht).
- **Länge (AP-04, Oberfläche):** Die Seite zeigt jeden Eintrag von Stärken, Schwächen und Tipps als Listenpunkt in einer Karte; ab mittlerer Breite stehen die Karten Stärken und Schwächen nebeneinander in zwei schmalen Spalten und die Karte Tipps darunter über die ganze Breite; bei schmaler Breite steht alles in einer Spalte (`CvView.vue`). Der Screen zeigt Einträge von sechs bis fünfzehn Wörtern. Die Zahl der Einträge begrenzt `CV_LIST_LIMITS` (Schritt 9).
- **Format (AP-05):** Die Seite setzt jeden Eintrag als reinen Text in einen Listenpunkt oder ein Schlagwort; Markdown würde als Zeichen erscheinen.

Entscheidung: Fünf Regeln in Prosa werden die Konstante `CV_ANALYSIS_RULES`. Die Sprachregel gilt nur für die Texte, die die Beraterin selbst schreibt – Stärken, Schwächen und Tipps –; übernommene Angaben folgen allein der zweiten Regel und stehen in der Schreibweise des Lebenslaufs, damit keine zwei Regeln um dieselben Felder konkurrieren; das gilt auch für einen englischen Lebenslauf, so dass die Seite dann etwa „German · native“ neben deutschen Einschätzungen zeigt (von der Person bestätigt). Fehlendes bleibt leer in der Form, die das Schema erlaubt: `null` in den nullbaren Feldern, „nicht genannt“ in den Pflichtfeldern einer Station oder Ausbildung, ein ganz unleserlicher Eintrag fehlt in seiner Liste; ein kaum lesbares Dokument benennt der Ausgabevertrag mit einer Schwäche und einem Tipp (Schritt 9). Die Längengrenze je Eintrag ist „höchstens etwa 20 Wörter“, als ausdrückliche Regel im Text mit ihrem eigenen Grund, der für alle drei Listen gilt: jeder Eintrag ein Listenpunkt in einer Karte, Stärken und Schwächen nebeneinander in zwei schmalen Spalten. Befund und Beleg tragen danach ihren eigenen Grund, die Prüfbarkeit am Lebenslauf (von der Person bestätigt; ein Beispiel dafür braucht es nicht, Schritt 11). Weniger Einträge statt Füllsätzen, damit jeder Eintrag einen eigenen Befund trägt.

Prompt-Teil: → `CV_ANALYSIS_RULES`

## 5. Context Slots — AP-15 bis AP-18, AP-20, AP-23 bis AP-27

Analyse:

- **AP-15:** Statisch sind Frame, Regeln, der Refocus und der Ausgabevertrag mit Rollenliste und Höchstzahlen; sie sind bei jeder Anfrage gleich. Dynamisch ist allein das PDF der Version. Rollenliste und Höchstzahlen kommen aus den Konstanten `CV_ROLES` und `CV_LIST_LIMITS`, die auch Schema, Service und Eval verwenden; sie werden in den Text eingesetzt, bleiben aber statisch.
- **AP-16:** Direkt: das hochgeladene PDF, die eigene Eingabe der Person. Indirekt: keiner. Boilerplate: Frame und Regeln oben im System-Prompt, Refocus und Ausgabevertrag als Text nach dem Dokument.
- **AP-17:** Abruf ist das Lesen von `pdf` der Version in `CvsService.upload` bzw. `retry`; Zuschnitt entfällt, weil die API das PDF selbst liest und das Dokument ganz gebraucht wird; Bewertung entfällt bei einem einzigen Dokument; Zusammenbau ist `cvAnalysisRequest`.
- **AP-18:** Nur das Dokument und die Rollenliste tragen zur Antwort bei. Das Datum der Anfrage wurde erwogen, weil eine Lücke bis heute davon abhängt; es bleibt draußen, weil der Ausgabevertrag Zeiträume ohne Station mit ihren Daten statt mit einer Dauer bis heute nennen lässt und sonst kein Feld vom heutigen Datum abhängt. Der Dateiname wird nicht gespeichert und fehlt deshalb.
- **AP-20:** Die Beraterin wüsste gern: das Dokument, die Rollen der App und ihre Grenzen, den Arbeitsmarkt der Rolle, das heutige Datum, frühere Versionen. Nah und stabil hat die App: das PDF (gespeichert) und die Rollenliste (Konstante). Frühere Versionen sind gespeichert, aber jede Version wird für sich ausgewertet (UC-05); den Arbeitsmarkt trägt das Modell aus dem Training bei.
- **AP-23:** Das PDF steht als eigener Document-Block im Nutzer-Turn; die API grenzt ihn ab, Beginn und Ende sind die Blockgrenzen, und der Frame nennt ihn als hochgeladenes Dokument der Person. Einen Titel bekommt der Block nicht: Ein Dateiname liegt nicht vor, und der Router-Test (`backend/tests/cvs/router.test.ts`, Zeile 78) erwartet den Block genau mit `type` und `source`. Refocus und Ausgabevertrag stehen zusammen in einem eigenen Text-Block danach, modular (einfügbar und entfernbar ohne das Dokument zu ändern) und träge (durch die Blockgrenze getrennt).
- **AP-24** entfällt – Einzelaufruf ohne Verlauf; ein neuer Versuch schickt dasselbe PDF neu, ohne den vorigen Versuch.
- **AP-25** entfällt – kein Abruf aus einem Index; das PDF wird über die Version gelesen.
- **AP-26:** Kein Retrieval, also keine parsbaren Belege; der Gedanke gilt aber: Einschätzungen nennen ihren Beleg im Lebenslauf (Regeln, Schritt 4), damit Person und Judge sie prüfen können.
- **AP-27** entfällt – das PDF geht ganz mit; eine kürzere Fassung gibt es nicht, die Größe begrenzt der Upload auf 5 MB.

Entscheidung: Drei Slots. (1) `CV_ANALYSIS_SYSTEM`: statisch, Boilerplate, aus Frame und Regeln, ohne `cache_control` (Schritt 6). (2) PDF: dynamisch, direkt, aus der Version in der Datenbank, als Document-Block im Nutzer-Turn, begrenzt auf 5 MB durch die Prüfung beim Hochladen. (3) `CV_ANALYSIS_REFOCUS` und `CV_ANALYSIS_CONTRACT`: statisch, Boilerplate, ein Text-Block nach dem Dokument (Schritte 7 und 9); Rollenliste und Höchstzahlen aus den vorhandenen Konstanten `CV_ROLES` und `CV_LIST_LIMITS`, die unverändert bleiben. Kein Datum, kein Dateiname, keine frühere Version.

Prompt-Teil: → `CV_ROLES`, `CvRole`, `CV_LIST_LIMITS`, Kopfkommentar (Slots)

## 6. Anordnung — AP-21, AP-22, AP-28

Analyse:

- **AP-21 Position:** Frame vor Regeln im System-Prompt; im Nutzer-Turn das Dokument, danach der Refocus, danach der Ausgabevertrag. **Wichtigkeit:** Frame, Regeln und Ausgabevertrag sind die oberste Stufe, das Dokument folgt; gekürzt wird nichts, weil das Dokument ganz gebraucht wird. **Abhängigkeit:** Refocus und Ausgabevertrag verlangen das Dokument vor sich; der Ausgabevertrag verlangt Rollenliste und Höchstzahlen, die als Konstanten vor ihm stehen. Eine Token-Zählung vor dem Senden gibt es nicht; ein zu großes Dokument endet im Batch als Fehler und wird als `batch_failed` gespeichert.
- **AP-22:** Frame und Regeln stehen oben im System-Prompt; Dokument, Refocus und Ausgabevertrag stehen unten im Nutzer-Turn, wie das §7-Skelett „Extraction sub-task“ (Frame, Dokument, Vertrag) und AP-22 es legen. AP-10 legt den statischen Vertrag in den System-Prompt; hier gilt das Skelett, weil der Vertrag Feld für Feld die Arbeit ist, die nach einem mehrseitigen Dokument ansteht, und hinter dem Dokument am stärksten wirkt. Der einzige Grund, ihn im System-Text zu halten, war ein gecachtes Präfix; er entfällt mit dem Caching (nächster Punkt).
- **Prompt-Caching:** Die Anfrage bekommt kein `cache_control`. Lebensläufe werden selten und einzeln hochgeladen; ein Schreiben in den Cache kostet das 1,25-Fache des Eingabepreises (5 Minuten Laufzeit), ein Lesen das 0,1-Fache, und der Cache lebt nur 5 Minuten. Fast jeder Upload würde also schreiben und nie lesen und mehr zahlen als ohne Caching. Ein Cache mit einer Stunde Laufzeit für die drei Läufe der Eval gehört zu Phase B; deshalb bleibt Caching der Eval überlassen.
- **AP-28:** Der Zusammenbau ist der minimale: ein fester System-Text, ein Dokument, ein Text-Block aus Refocus und Vertrag. Keine Bewertung, kein Kürzen, keine Auswahl.

Entscheidung: `CV_ANALYSIS_SYSTEM` verbindet `CV_ANALYSIS_FRAME` und `CV_ANALYSIS_RULES` mit einer Leerzeile und geht als System-Text ohne `cache_control`; danach ein Nutzer-Turn aus Document-Block und einem Text-Block aus `CV_ANALYSIS_REFOCUS` und `CV_ANALYSIS_CONTRACT`, mit einer Leerzeile verbunden. Der vorhandene `cvAnalysisRequest` ändert sich an zwei Stellen: `system` ist der Text ohne `cache_control`, und statt des bisherigen Satzes „Werte das Dokument oben als Lebenslauf aus.“ trägt der Text-Block Refocus und Vertrag. Der Router-Test prüft nur Modell, Effort und den Document-Block (`toContainEqual`) und bleibt gültig.

Prompt-Teil: → `CV_ANALYSIS_SYSTEM`, `cvAnalysisRequest`

## 7. Refocus und Transition — AP-29

Analyse:

- **AP-29:** Einleitung ist der System-Text aus Frame und Regeln, Kontext ist das Dokument, danach folgen Refocus und Ausgabevertrag. Ein Refocus bleibt nötig, weil ein mehrseitiger Lebenslauf zwischen Einleitung und Antwort steht und die Aufmerksamkeit vor dem Vertrag zur Aufgabe zurückkehren soll; das Retrieval-Skelett in §7 legt ihn ebenso vor den Vertrag. In seiner bisherigen Form wiederholte er die Reihenfolge der Felder, weil der Vertrag vor dem Dokument stand; jetzt nennt der Vertrag sie unmittelbar danach, und die Wiederholung wäre doppelter Text, der nichts zur Antwort beiträgt (AP-18). Der Refocus wird deshalb der Fokus-Satz, der den Vertrag einleitet: Er nimmt die Aufgabe im Ton des Frames wieder auf und steht mit dem Vertrag in einem Text-Block. Eine Markierung wie im Coach braucht er nicht: Dort steht der Hinweis neben dem Text der Person und könnte ihr zugeschrieben werden; hier baut die App den ganzen Nutzer-Turn, und Refocus und Vertrag sind durch die Blockgrenze vom Dokument getrennt. Die Transition liefert die API: Structured Outputs lassen die Antwort als JSON nach dem Schema beginnen; eine Vorbelegung (Prefill, RP-07) braucht es nicht.

Entscheidung: Zwei kurze Sätze als Konstante `CV_ANALYSIS_REFOCUS`, im Text-Block nach dem Document-Block vor `CV_ANALYSIS_CONTRACT`; die Reihenfolge der Felder nennt allein der Vertrag. Keine eigene Transition im Text.

Prompt-Teil: → `CV_ANALYSIS_REFOCUS`

## 8. Preamble und Reasoning — AP-34, AP-35, AP-39 bis AP-41, AP-45

Analyse:

- **AP-34:** Strukturelle Vorlage entsteht nicht im Text: Das JSON-Schema geht über `output_config.format` mit, und die API erzwingt die Form. Füllsätze haben im Schema keinen Platz; innerhalb der Texte hält die Regel „Befund zuerst, dann Beleg“ sie klein, und die Höchstzahlen schneiden Überzähliges ab.
- **AP-35:** Das Modell hat eingebautes Thinking; der Thinking-Block ist der Notizbereich, den die API vom JSON trennt, und der Service liest nur den Text-Block. Ein Notizfeld im Schema entfällt deshalb.
- **AP-39:** Die Rolle und die Einschätzung verlangen Abwägen über den ganzen Werdegang. Ein erstes Token ist eine Eingebung: Stünde `suggested_role` wie bisher vor den Stationen, legte das Modell die Rolle fest, bevor es den Werdegang aufgeschrieben hat. Deshalb rückt die Rolle hinter die übertragenen Felder, und Stärken, Schwächen und Tipps folgen ihr, weil sie sich auf die Zielrolle beziehen. `is_cv` bleibt vorn, weil alles Weitere davon abhängt.
- **AP-40** entfällt – kein Hinweis „Schritt für Schritt“; die Tiefe steuern adaptives Thinking und der Effort als Parameter.
- **AP-41:** Plan und Ausführung trennt die Reihenfolge der Felder: erst entscheiden (Lebenslauf ja oder nein), dann übertragen, dann urteilen. Einen eigenen Planschritt braucht die Aufgabe nicht.
- **AP-45** entfällt – ein Aufruf je Version; mehrere Perspektiven mit Zusammenführung würden die Kosten vervielfachen, ohne dass ein Bedarf gemessen ist.

Entscheidung: Kein Text vor dem JSON; Nachdenken nur im eingebauten Thinking (`adaptive`, Tiefe über `CV_ANALYSIS_EFFORT`). Im Schema (Schritt 9) rückt `suggested_role` hinter `languages`, vor `strengths`, `weaknesses` und `tips`; die Reihenfolge ändert nur die Ausgabe, nicht Validierung, Speicherung, Seite oder Tests.

Prompt-Teil: → `cvAnalysisRequest` (`thinking`)

## 9. Output Contract und Stop — AP-32, AP-33

Analyse:

- **AP-32:** JSON, weil die API das Schema über Structured Outputs erzwingt und Zod es danach prüft; das JSON-Schema kommt per `z.toJSONSchema()` aus demselben Zod-Schema. Lange Freitexte gibt es nicht: Die längsten Strings sind Einschätzungen von höchstens etwa 20 Wörtern. Feldbeschreibungen im Schema (`.describe()`) würden das Modell erreichen – Anthropics Dokumentation zur Umformung des Schemas im SDK verschiebt nicht unterstützte Einschränkungen gerade deshalb in die Beschreibungen der Felder, damit Claude sie sieht. Der Vertrag Feld für Feld steht trotzdem nur als Prosa nach dem Dokument, wie das §7-Skelett ihn legt, damit alle Regeln zu den Feldern an einer Stelle stehen und kein Text doppelt im Prompt steht: jedes Feld mit dem, was bei Fehlen gilt. Pflicht-Strings mit einem ausdrücklich genannten Ersatzwert sind optionalen oder nullbaren Feldern vorzuziehen, wie Anthropics Hinweise zu Structured Outputs raten, Parameter möglichst als Pflicht anzulegen und Claude den Ersatzwert ausdrücklich angeben zu lassen; deshalb bleiben `employer`, `title`, `degree` und `institution` Pflicht-Strings mit „nicht genannt“.
- **Feldvertrag:** Die Eval prüft genau: Zahl der Stationen gleich Gold, jeder Arbeitgeber gefunden, jede Muss-Kenntnis gefunden, keine abwesende Kenntnis, Sprachen gleich, höchster Abschluss gefunden, Höchstzahlen schon in der rohen Antwort. Dafür braucht jedes Feld eine Abgrenzung: was als Station zählt (sonst schwankt die Zahl), dass Kenntnisse beim Namen genannt sein müssen, wie Daten aussehen, was `null` heißt und was in den Pflicht-Strings `employer`, `title`, `degree`, `institution` und `name` steht, wenn das Dokument sie nicht nennt. Ohne diese Angabe müsste das Modell unter Structured Outputs einen String erfinden oder leer lassen; mit „nicht genannt“ bleibt die Station gezählt (die Eval prüft die Zahl) und die Lücke auf der Seite und im Coach lesbar, ohne dass Schema, `CvView.vue` oder `cvAside` sich ändern. Eine Sprache gibt es nur mit ihrem Namen; für `name` gilt deshalb, dass nur beim Namen genannte Sprachen in die Liste kommen. Für die Reihenfolge der Listen hat jede genau ein Kriterium: `positions`, `skills` und `education` die zeitliche Ordnung, die das Feld nennt, `languages`, `strengths`, `weaknesses` und `tips` das Wichtigste zuerst, weil die App überzählige Einträge am Ende abschneidet und die Seite die Listen in der gelieferten Reihenfolge zeigt. `end: null` zeigt die Seite als „heute“ und der Coach als „bis heute“; das legt fest, dass `null` eine laufende Station meint. `language` prüft der Service gegen `de` und `en` in Kleinbuchstaben; das Feld ist deshalb ein Sprachcode. Bei `is_cv: false` lehnt der Service ab; leere Felder halten die Antwort kurz und bringen nichts aus einem fremden Dokument in den Bogen. Die Rollenliste trägt je Rolle eine kurze Abgrenzung, damit gleiche Werdegänge gleich eingeordnet werden; eine typisierte Liste `Record<CvRole, string>` stellt sicher, dass jede Rolle eine hat.
- **AP-33:** Fertig ist die Antwort, wenn das Schema erfüllt ist und der Aufruf mit `end_turn` endet. `max_tokens` (16000, einschließlich Thinking) ist nur das Sicherheitsnetz. Der Parser liest den ersten Text-Block, `JSON.parse`, dann `cvAnalysisSchema.safeParse`; der Thinking-Block bleibt ungelesen.

Entscheidung: Der Ausgabevertrag wird die Konstante `CV_ANALYSIS_CONTRACT`, eine kurze Einleitung (Schema und Höchstzahlen als von der App geprüft, je Liste genau ein Ordnungskriterium) und eine Liste der Felder in der Reihenfolge des Schemas, jedes mit dem, was bei Fehlen gilt: `null` in den nullbaren Feldern, „nicht genannt“ in `employer`, `title` und `institution`, in `degree` das Genannte aus Abschluss und Fach und „nicht genannt“ ohne beides, in `languages` nur beim Namen genannte Sprachen, mit `name` und `level` in der Schreibweise des Lebenslaufs, auch bei einem englischen (von der Person bestätigt). „Nicht genannt“ in den Pflicht-Strings hat die Person bestätigt; die Felder bleiben Pflicht-Strings, das Schema ändert sich dafür nicht. Die Rollen kommen mit ihrer Abgrenzung aus `CV_ROLE_DESCRIPTIONS`; die elf Abgrenzungen hat die Person so bestätigt, und die Person bestätigt oder ändert die vorgeschlagene Rolle danach auf der Seite. Lässt sich das Dokument kaum lesen, nennt eine Schwäche das und ein Tipp rät, eine PDF mit Textebene hochzuladen, etwa direkt aus dem Textprogramm exportiert; ein Satz am Ende des Vertrags sagt das. Der Vertrag steht im Nutzer-Turn nach dem Refocus (Schritte 6 und 7), nicht im System-Text. Das Schema bleibt bis auf die Stellung von `suggested_role` (Schritt 8) gleich; `CV_ANALYSIS_MAX_TOKENS` bleibt 16000.

Prompt-Teil: → `cvAnalysisSchema`, `CvAnalysis`, `CV_ANALYSIS_JSON_SCHEMA`, `CV_ANALYSIS_MAX_TOKENS`, `CV_ROLE_DESCRIPTIONS`, `CV_ANALYSIS_CONTRACT`, Kopfkommentar (Stop)

## 10. Enforcement Line und Tools — AP-42, AP-44, AP-46 bis AP-49

Analyse:

- **AP-42** entfällt – kein Agenten-Loop; ein Aufruf je Version.
- **AP-44** entfällt – kein automatischer Neuversuch mit Bewertung; „Erneut versuchen“ ist ein neuer Aufruf auf Wunsch der Person, ohne den vorigen Versuch, und bei `not_cv` und `language` bietet die Seite stattdessen eine andere Datei an.
- **AP-46** entfällt – keine Tools; die Form erzwingt das Schema über Structured Outputs.
- **AP-47** entfällt – keine Tool-Argumente; was die App weiß, setzt sie selbst: Modell, Effort, Schema und das PDF.
- **AP-48** entfällt – keine Tool-Ergebnisse oder Tool-Fehler.
- **AP-49** entfällt – der Aufruf ändert nichts außerhalb des Bogens; die vorgeschlagene Rolle wird erst zur Zielrolle, wenn die Person sie auf der Seite bestätigt (`confirmRole`), bis dahin zeigen Seite und Coach sie als Vorschlag.
- **Grenze:** Der Prompt bittet nur um: Abgrenzung von Station, Kenntnis, Abschluss und Sprache, Schreibweise wie im Lebenslauf, Datumsform, deutsche Einschätzungen mit Beleg, Länge der Einträge, Höchstzahlen, Wahl der Rolle, Bindung an das Dokument, Text im Dokument als Material, Schwäche und Tipp bei einem kaum lesbaren Dokument. Die App prüft: Zod-Validierung der Antwort (Rolle aus `CV_ROLES` per Enum), `is_cv: false` als `not_cv`, eine Sprache außer `de` und `en` als `language`, Listen gekürzt auf `CV_LIST_LIMITS`, `max_tokens` als `too_long`, `refusal` als `refused`, jede andere ungültige Antwort als `invalid_output`, Fehler des Batches als `batch_failed`; PDF bis 5 MB mit Kennung `%PDF-` beim Hochladen; nur die eigene Version wird ausgewertet (Filter nach `userId`).

Entscheidung: Keine Tools. Die Grenze steht im Kopfkommentar; der vorhandene `evaluate` im Service bleibt unverändert. Ein kaum lesbares Dokument wird nur erbeten benannt (Schwäche und Tipp, Schritt 9) und als `ready` gespeichert; ein eigener Fehlergrund dafür im Modul `cvs` ist nicht Teil dieser Unit (Offene Punkte). Was nur erbeten ist, misst die Eval in Phase B.

Prompt-Teil: → Kopfkommentar (Enforced in code)

## 11. Beispiele — AP-36 bis AP-38

Analyse:

- **AP-36:** Beispiele würden Datumsform, Abgrenzung der Stationen und den Ton der Einschätzungen zeigen. Alle drei sagt der Ausgabevertrag ausdrücklich; ein Aspekt, der danach unklar bliebe, ist vor der Messung nicht benannt.
- **AP-37:** Ein Beispiel bräuchte einen ganzen Lebenslauf als Kontext und wäre lang (a); ein Beispielbogen hätte eine Rolle, eine Sprache und eine Zahl an Stationen und würde sie verankern (b); und seine Kenntnisse könnten in echte Bögen wandern, was genau die Prüfung auf abwesende Kenntnisse träfe (c).
- **AP-38:** Die erste Bedingung (ein benannter Aspekt bleibt unklar) ist nicht erfüllt, und ein ganzer Bogen wäre ein vollständiges Ergebnis, das AP-38 als Beispiel ausschließt. Damit bleibt die Unit ohne Beispiele, bis die Eval einen offenen Aspekt zeigt.

Entscheidung: Zero-shot. Beispiele erst, wenn ein Fund aus der Eval einen Aspekt benennt, den der Ausgabevertrag nicht festlegt, und dann nur für diesen Aspekt.

Prompt-Teil: entfällt – keine Beispiele.

## 12. Vier Kriterien am ganzen Prompt — AP-04

1. Ähnelt einem Trainingsdokument: ja – der System-Text öffnet als Auswertungsbogen einer Karriereberatung zu einem hochgeladenen Lebenslauf, in der dritten Person, und ist ruhige, sachliche deutsche Prosa in kurzen Absätzen, im Ton der Einschätzungen, die der Bogen enthalten soll; im Nutzer-Turn folgt auf das Dokument ein kurzer Fokus-Satz und eine Ausfüllanleitung Feld für Feld, wie sie zu einem Erfassungsbogen gehört; die Antwort ist ein JSON-Objekt, das Structured Outputs nach dem Schema erzwingt.
2. Alle nötigen Informationen enthalten: ja – das ganze PDF als Document-Block (Text und Bild jeder Seite, auch bei einem Scan), die Rollenliste mit je einer Abgrenzung aus `CV_ROLE_DESCRIPTIONS`, die Höchstzahlen aus `CV_LIST_LIMITS`, je Feld die Abgrenzung, die Datumsform und was bei Fehlen steht (`null`, „nicht genannt“, Eintrag fehlt), die Sprache der Einschätzungen und die Schreibweise übernommener Angaben. Bewusst fehlen das heutige Datum (der Vertrag lässt Zeiträume ohne Station mit ihren Daten nennen), der Dateiname und frühere Versionen; den Arbeitsmarkt der Zielrolle trägt das Modell aus dem Training bei.
3. Führt zur Lösung, nicht zu mehr Problem: ja – der Refocus direkt nach dem Dokument nennt die Aufgabe (übertragen und einschätzen), und der Vertrag folgt unmittelbar mit den Feldern in der Reihenfolge der Ausgabe; erst die Entscheidung `is_cv`, dann das Übertragen, dann Rolle und Urteil. Fehlendes führt zu einem leeren Feld statt zu einer Rückfrage, ein kaum lesbares Dokument zu einer Schwäche und einem Tipp mit Ausweg, Text im Dokument, der sich an den Leser richtet, bleibt Material.
4. Natürliches Ende: ja – die Antwort endet, wenn das JSON-Objekt nach `tips` geschlossen ist und das Schema erfüllt, mit `end_turn`; die Listen sind durch die genannten Höchstzahlen begrenzt und bleiben kürzer, wenn der Lebenslauf weniger hergibt, jeder Eintrag hat höchstens etwa 20 Wörter; `CV_ANALYSIS_MAX_TOKENS` (16000, einschließlich Thinking) ist nur das Sicherheitsnetz.

## Offene Punkte

Was nur die Person entscheiden kann oder außerhalb dieser Unit liegt, je Punkt: was, warum, welcher Schritt, was nötig wäre.

- **Zählung im `gold.json` (Schritt 9, Phase B):** Die Eval verlangt die Zahl der Stationen genau wie im Gold. Das Blatt zählt Anstellungen, Praktika, Werkstudententätigkeiten, Selbstständigkeit und freie Mitarbeit, keine Berufsausbildung, Projekte oder Ehrenamt, und Kenntnisse nur, wenn sie beim Namen genannt sind; ein fehlender Arbeitgeber steht als „nicht genannt“. Nötig: dieselbe Abgrenzung und Schreibweise in `backend/evals/cv_analysis/review.md` und für den Sample-Writer, wenn `/eval-setup cv_analysis` läuft; in Phase A nichts unter `backend/evals/` ändern.
- **Unleserliches Dokument (Schritte 4 und 10, außerhalb der Unit, Phase B):** Ein eigener Fehlergrund im Modul `cvs` ist ein eigener Schritt, falls die Eval mit dem Fall „scan without text layer“ zeigt, dass Schwäche und Tipp nicht genügen.
- **Seitenzahl des PDF (Schritte 5 und 10, außerhalb der Unit):** Der Upload begrenzt nur die Größe (5 MB); die Seitengrenze der API liegt für Modelle mit 1M Kontext wie Haiku 5.5 bei 600 Seiten, was ein Lebenslauf bis 5 MB kaum erreicht. Nur wenn es doch vorkommt (`batch_failed`, „Erneut versuchen“ scheitert wieder), wäre im Modul `cvs` die Seitenzahl beim Hochladen zu prüfen.

## Fassungen

| Fassung | Ergebnis | Fund aus der Eval | Schritt | Änderung |
| ------- | -------- | ----------------- | ------- | -------- |
| 1 | geprüft und in `backend/src/prompts/cv_analysis.ts` zusammengebaut; Modell und Effort geschätzt, noch nicht gemessen | entfällt – Phase A, noch keine Eval | 1–11 | erste Fassung aus dem Blatt: Frame, Regeln, Refocus und Vertrag als Konstanten, System-Text ohne `cache_control`, Refocus und Vertrag als Text-Block nach dem Dokument, `suggested_role` hinter `languages`; Längenregel mit eigenem Grund nach Fund N1 aus dem Review (Schritt 4); Grund der Längenregel für alle drei Listen und Tipps mit der Handlung zuerst allein in der Regel nach Code-Review P1 und P2 (Schritte 4 und 9) |
