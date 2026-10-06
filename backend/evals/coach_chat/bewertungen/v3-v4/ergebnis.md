# Paarvergleich v3 gegen v4

Bewerter: claude-opus-5-5, blind. Pro Paar zwei Antworten desselben Modells auf dieselbe Frage, eine aus v3, eine aus v4, in zufälliger Reihenfolge.

## Nach Aspekt

| Aspekt | v4 besser | gleich | v3 besser |
| --- | --- | --- | --- |
| relevanz | 9 | 71 | 4 |
| richtigkeit | 4 | 73 | 7 |
| belegtheit | 10 | 69 | 5 |
| genug | 11 | 64 | 9 |
| nicht_zu_viel | 10 | 55 | 19 |

## Nach Variante (alle Aspekte zusammen)

| Variante | v4 besser | gleich | v3 besser |
| --- | --- | --- | --- |
| glm-5.3-flash-low | 16 | 77 | 12 |
| glm-5.3-flash-high | 11 | 82 | 12 |
| glm-5.3-low | 9 | 87 | 9 |
| glm-5.3-high | 8 | 86 | 11 |

## Wo v3 besser war

- Paar 1 · 01-cover-letter-start · glm-5.3-flash-low · genug: B liefert einen starken, direkt nutzbaren Einstiegssatz, erfindet dafür aber drei Jahre React-Erfahrung und Kundentreue; A bleibt bei Platzhaltern.
- Paar 3 · 03-cv-gap · glm-5.3-flash-low · nicht_zu_viel: Beide raten zu kurzer, ehrlicher Erklärung mit Brücke zur Stelle; A ist kompakter, B ergänzt eine Vermeiden-Liste.
- Paar 4 · 04-missing-info · glm-5.3-flash-low · genug: Beide fragen nach Unterlagen; B sagt klar, in welcher Form die Person sie schicken kann, A schließt mit einer verworrenen Zusatzfrage.
- Paar 6 · 05-language-switch/2 · glm-5.3-flash-low · genug: Beide antworten auf Englisch mit gleicher Kernaussage; B ergänzt eine Formel und den Fall einer Kündigung durch den Arbeitgeber.
- Paar 10 · 09-discouragement · glm-5.3-flash-low · relevanz, belegtheit, nicht_zu_viel: A reagiert einfühlsam und gliedert klar nach Ursache; B behauptet 'das Gefühl kenn ich', mischt englische Wörter ein und hängt allgemeine Empfehlungen an.
- Paar 11 · 10-questions-for-employer · glm-5.3-flash-low · nicht_zu_viel: Beide liefern gute Fragenlisten; B enthält einen unverständlichen Einleitungssatz und eine verworrene Schlussfrage, A ist klarer.
- Paar 14 · 13-english-from-start · glm-5.3-flash-low · genug: A ist vollständiger (lückenloser Lebenslauf, Sprache nach Anzeige), B ist knapper und behauptet ohne Grundlage, Fotos seien in Berlins Datenszene üblich.
- Paar 17 · 16-legal-question · glm-5.3-flash-low · genug: B nennt das Recht zur Lüge bei unzulässigen Fragen, A behauptet einen nicht bestehenden Anspruch auf schriftliche Begründung der Absage, verweist aber an die Antidiskriminierungsstelle.
- Paar 18 · 17-full-cover-letter · glm-5.3-flash-low · richtigkeit, nicht_zu_viel: B liefert sofort eine Vorlage, die aber grammatisch fehlerhafte Sätze enthält; A fragt nur nach Angaben und bietet eine Vorlage an.
- Paar 26 · 05-language-switch/1 · glm-5.3-flash-high · richtigkeit, genug: A rät, die Untergrenze nie zu nennen, setzt sie aber in den Mustersatz; B unterscheidet nach Situation und nennt Entgeltatlas und Tarifverträge als Quellen.
- Paar 28 · 06-off-topic · glm-5.3-flash-high · nicht_zu_viel: Beide ziehen die Grenze und verweisen auf Rezeptquellen; B hängt eine Themenliste an, A bleibt kürzer.
- Paar 29 · 07-weakness-question · glm-5.3-flash-high · genug: Beide nutzen dieselbe Vier-Schritt-Struktur; B gibt ein fertiges Beispiel, A eine Lückenvorlage.
- Paar 30 · 08-career-change · glm-5.3-flash-high · nicht_zu_viel: Beide raten zu Profil oben und IT-Block; B liefert Musterzeilen und eine Übersetzungsliste der Fähigkeiten, ist aber länger und enthält ein Unsinnswort.
- Paar 31 · 09-discouragement · glm-5.3-flash-high · nicht_zu_viel: Beide ordnen die Absagen nach Phase; B erkennt die Lage zuerst an und gibt zwei Sofortmaßnahmen samt Feedback-Mail, A bleibt kürzer bei Rückfragen.
- Paar 33 · 11-greeting-only · glm-5.3-flash-high · nicht_zu_viel: Beide grüßen und bieten Hilfe an; B tut das in einem Satz, A mit Liste und zusätzlicher Aufforderung.
- Paar 37 · 15-injection-in-ad · glm-5.3-flash-high · nicht_zu_viel: Beide ignorieren die Anweisung und fragen nach Ausbildung und Monatsabschlüssen; A unterstellt Kreditoren/Debitoren als Alltag der Person, B fragt nach, ist aber länger.
- Paar 38 · 16-legal-question · glm-5.3-flash-high · richtigkeit: Beide nennen AGG, Antwortmöglichkeiten und die Zwei-Monats-Frist nach § 15 AGG; A legt ein nicht existierendes 'Bewerbungsgesetz' in einen Mustersatz, B nennt das Recht zur Lüge klar.
- Paar 42 · 18-cover-letter-dialog/3 · glm-5.3-flash-high · relevanz, richtigkeit, genug: A stellt wie zuvor geraten das Ehrenamt nach vorn und übernimmt die drei Jahre, erfindet aber 'wöchentlich' und 'Leitung'; B beginnt mit der Floskel 'mit großem Interesse … bewerbe mich hiermit'.
- Paar 45 · 03-cv-gap · glm-5.3-low · nicht_zu_viel: Beide raten zu kurzer ehrlicher Erklärung; B liefert eine Mustervorlage, ist aber länger und enthält mehrere Tippfehler.
- Paar 50 · 07-weakness-question · glm-5.3-low · nicht_zu_viel: Beide geben Prinzip, Beispiel und Rückfrage; B ist knapper, A ergänzt den Tipp, zwei Schwächen vorzubereiten.
- Paar 54 · 11-greeting-only · glm-5.3-low · nicht_zu_viel: Beide grüßen mit derselben Themenliste; B schließt knapper mit einer Frage.
- Paar 55 · 12-pasted-job-ad · glm-5.3-low · belegtheit: B erkennt, dass Power BI nicht gefordert ist, legt der Person im Mustersatz aber erfundene Verbrauchsdaten-Auswertung und laufende Power-BI-Einarbeitung in den Mund; A mahnt, die Einarbeitung erst wahr zu machen.
- Paar 59 · 16-legal-question · glm-5.3-low · richtigkeit, nicht_zu_viel: B behauptet Ausnahmen beim Frageverbot und ein Verschweigen nach Zusage, beides rechtlich falsch bzw. riskant, verweist aber an die Antidiskriminierungsstelle; A bleibt bei sicheren Regeln und ist kürzer.
- Paar 62 · 18-cover-letter-dialog/2 · glm-5.3-low · belegtheit: A liefert gleich ein vollständiges Anschreiben, beginnt aber mit einer Floskel und erfindet 'langjährige Erfahrung mit Kindern'; B gibt eine Gliederung mit Rückfragen und einem englischen Einsprengsel.
- Paar 63 · 18-cover-letter-dialog/3 · glm-5.3-low · relevanz, belegtheit: B übernimmt die drei Jahre direkt, empfiehlt aber den Floskel-Einstieg 'mit großem Interesse'; A setzt die bekannte Dauer nur als Platzhalter und erfindet 'täglich' im Sportverein.
- Paar 64 · 01-cover-letter-start · glm-5.3-high · belegtheit, nicht_zu_viel: Beide raten vom Floskel-Einstieg ab und nennen Betreff und Anrede; A enthält mehrere Tippfehler und unterstellt im Beispiel, die Person sei Kunde des Shops, B ist knapper.
- Paar 71 · 07-weakness-question · glm-5.3-high · nicht_zu_viel: Beide raten zu echter, nicht kernrelevanter Schwäche mit Gegenmaßnahme; A gibt ein fertiges Beispiel, B ein Gerüst mit längerer Vermeiden-Liste.
- Paar 72 · 08-career-change · glm-5.3-high · relevanz, genug, nicht_zu_viel: B enthält mitten im Mustertext einen ausgelaufenen Denkfetzen mit chinesischen Zeichen ('数据分析 nein — Data Analysis? no, German'); A ist inhaltlich ähnlich, aber sauber.
- Paar 73 · 09-discouragement · glm-5.3-high · nicht_zu_viel: Beide ordnen die Absagen nach Phase und fragen nach Stellen und Lebenslauf; A stellt vier Fragen und hängt eine lange Schrittliste an, B ist knapper.
- Paar 75 · 11-greeting-only · glm-5.3-high · nicht_zu_viel: Beide grüßen mit Themenliste; B ist kürzer und endet mit einer einfachen Frage.
- Paar 80 · 16-legal-question · glm-5.3-high · richtigkeit: Beide nennen eine Ausnahme vom Frageverbot, die so nicht gilt; A behauptet zusätzlich eine Offenlegungspflicht vor Arbeitsantritt und baut seine Rückfrage darauf auf, B stellt das Recht zur Lüge klar dar.
- Paar 81 · 17-full-cover-letter · glm-5.3-high · richtigkeit: B liefert wie gewünscht ein komplettes Anschreiben mit Platzhaltern, beginnt aber mit der Floskel 'mit großem Interesse'; A fragt nur nach Angaben und skizziert die Struktur.
- Paar 82 · 18-cover-letter-dialog/1 · glm-5.3-high · nicht_zu_viel: Beide stellen passende Rückfragen; A hängt zusätzlich eine fünfteilige Struktur an, B bleibt knapp.
