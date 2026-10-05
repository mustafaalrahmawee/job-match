# Paarvergleich v1 gegen v2

Bewerter: Claude, blind. Pro Paar zwei Antworten desselben Modells auf dieselbe Frage, eine aus v1, eine aus v2, in zufälliger Reihenfolge.

## Nach Aspekt

| Aspekt | v2 besser | gleich | v1 besser |
| --- | --- | --- | --- |
| relevanz | 4 | 73 | 7 |
| richtigkeit | 3 | 78 | 3 |
| belegtheit | 6 | 75 | 3 |
| genug | 5 | 72 | 7 |
| nicht_zu_viel | 16 | 65 | 3 |

## Nach Variante (alle Aspekte zusammen)

| Variante | v2 besser | gleich | v1 besser |
| --- | --- | --- | --- |
| glm-5.3-flash-low | 15 | 86 | 4 |
| glm-5.3-flash-high | 8 | 92 | 5 |
| glm-5.3-low | 7 | 92 | 6 |
| glm-5.3-high | 4 | 93 | 8 |

## Wo v1 besser war

- Paar 6 · 05-language-switch/2 · glm-5.3-flash-low · genug: Beide antworten wie gewünscht auf Englisch mit zukunftsgerichteter Struktur; A liefert eine vollständige Beispielantwort und einen Hinweis für echte negative Gründe, B ist deutlich knapper.
- Paar 14 · 13-english-from-start · glm-5.3-flash-low · richtigkeit: Beide antworten auf Englisch mit einer passenden Gliederung; B behauptet fälschlich, das Foto sei „seit 2022“ optional, A ist hier korrekt, aber ausführlicher.
- Paar 20 · 18-cover-letter-dialog/2 · glm-5.3-flash-low · belegtheit: Beide nutzen die vier Jahre Erwachsenenstation und das Ehrenamt für einen Aufbau; B macht aus „betreue“ eine „Leitung“ der Sportgruppe, A bleibt bei den Angaben der Person.
- Paar 21 · 18-cover-letter-dialog/3 · glm-5.3-flash-low · relevanz: B stellt wie zuvor besprochen das Ehrenamt nach vorn, beginnt aber mit einem kaputten Satz („liebe Bewerbung um die Stelle…“) und überträgt die drei Jahre auch aufs Ehrenamt; A liefert einen sauberen, direkt nutzbaren Absatz mit den korrigierten drei Jahren, startet aber mit der Floskel „mit großem Interesse“ und lässt das Ehrenamt hinten.
- Paar 29 · 07-weakness-question · glm-5.3-flash-high · genug: A liefert zusätzlich zwei vollständige Vorbildformulierungen, die die Person direkt anpassen kann, ist dafür aber mit eigenem Begründungsabschnitt deutlich länger; B gibt dasselbe Muster kompakter.
- Paar 38 · 16-legal-question · glm-5.3-flash-high · relevanz, genug: A rät mit falschen Normen (§ 20 AGG, § 611a BGB) und empfiehlt bei sichtbarer Schwangerschaft eine fragwürdige Zusage, B verweist mit Frist und Antidiskriminierungsstelle an eine Fachstelle, behauptet aber fälschlich, eine Lüge könne den Vertrag gefährden.
- Paar 39 · 17-full-cover-letter · glm-5.3-flash-high · relevanz, genug: B liefert wie gewünscht ein komplettes Anschreiben, erfindet dabei nichts, weil alle Fakten Platzhalter sind, wird aber lang; A verspricht das Anschreiben, gibt nur die Struktur und fragt erst nach Angaben.
- Paar 43 · 01-cover-letter-start · glm-5.3-low · nicht_zu_viel: Beide geben einen ähnlichen Beispielsatz mit Begründung; A schließt mit drei mehrteiligen Rückfragen, B mit einer einzigen, auch wenn Bs Beispiel selbst fast die Floskel „mit Interesse“ verwendet, vor der es warnt.
- Paar 52 · 09-discouragement · glm-5.3-low · relevanz, genug, nicht_zu_viel: A antwortet auf die Frustration nur kurz und stellt dann fünf Fragen auf einmal; B ordnet die Absagen ermutigend ein (Strategie statt Ausdauer), nennt typische Ursachen und einen klaren nächsten Schritt mit nur einer Kernfrage.
- Paar 59 · 16-legal-question · glm-5.3-low · relevanz, genug: Beide nennen die Grundregel und das Recht zur Lüge richtig; A zitiert zwar eine falsche Norm (§ 7 MuSchG), verweist aber an die Antidiskriminierungsstelle und Rechtsberatung, B nennt eine veraltete Ausnahme und keine Fachstelle.
- Paar 64 · 01-cover-letter-start · glm-5.3-high · belegtheit, nicht_zu_viel: As Beispiele setzen React, TypeScript und E-Commerce-Erfahrung voraus, B arbeitet durchgehend mit Platzhaltern und ist mit einem Beispiel und knapper Begründung kompakter.
- Paar 68 · 05-language-switch/1 · glm-5.3-high · richtigkeit: B rät im ersten Satz, das Wunschgehalt ans obere Ende der Spanne zu setzen, was der eigenen späteren Formel widerspricht und die Person unter ihr Ziel bringen kann; A bleibt durchgehend bei der richtigen Regel (Wunschzahl unten).
- Paar 72 · 08-career-change · glm-5.3-high · belegtheit: A schreibt der Person im Beispielprofil acht Jahre, „Systemadministration von Lernplattformen“ und konkrete Zahlen zu, B arbeitet mit Platzhaltern und „falls…?“-Übersetzungen, die die Person selbst prüft.
- Paar 77 · 13-english-from-start · glm-5.3-high · relevanz, genug: A antwortet auf die englische Frage auf Deutsch, B auf Englisch und dazu mit vollständigerer Gliederung (Lückenlosigkeit, Sprachniveaus, Zeugnisse als Anlage).
- Paar 80 · 16-legal-question · glm-5.3-high · richtigkeit: Beide nennen Grundregel, Recht zur falschen Antwort, Zwei-Monats-Frist und eine Fachstelle; A nennt aber als Ausnahme Gefährdungen nach dem Mutterschutzgesetz, die nach heutiger Rechtsprechung die Frage nicht erlauben, B bleibt bei der engen Befristungs-Ausnahme und stützt sich auf das BAG.
- Paar 84 · 18-cover-letter-dialog/3 · glm-5.3-high · relevanz: B stellt das Ehrenamt wie vereinbart an den Anfang, erfindet aber „täglich“ und „schon lange“; A kündigt das Ehrenamt vorne an, beginnt den Absatz dann doch mit der Station, bleibt dafür bei den Angaben der Person.
