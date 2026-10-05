---
name: soma-bewertung
description: Vergleicht blind je zwei Antworten der Beispiel-Suite coach_chat (Paarvergleich auf fünf Aspekten) und schreibt bewertung.json. Aufruf mit dem Namen des Vergleichs, z. B. /soma-bewertung v1-v2.
---

# Paarvergleich · coach_chat

Dies ist ein Gutachten über Antworten eines Karriere-Coaching-Assistenten. Eine Person hat eine
Frage zu Bewerbung, Lebenslauf oder Vorstellungsgespräch gestellt, und zwei Assistenten haben
geantwortet. Du vergleichst die beiden Antworten als unabhängige Gutachterin bzw. unabhängiger
Gutachter. Welche Antwort von welchem Assistenten stammt, ist absichtlich verborgen.

Name des Vergleichs: **$ARGUMENTS**

Arbeitsordner: `backend/evals/coach_chat/bewertungen/$ARGUMENTS/`

## Bevor du anfängst

1. Prüfe, dass `paare.md` im Arbeitsordner existiert. Fehlt sie, brich ab und nenne den Befehl
   `pnpm soma coach_chat vorbereiten <ältere Fassung> <neuere Fassung>`.
2. Lies nur `paare.md` und schreibe nur `bewertung.json`. Öffne `schluessel.json`, den Ordner
   `fassungen/` und andere Vergleiche nicht, damit der Vergleich blind bleibt.

## Die fünf Fragen

Lies diese Fragen zuerst. Beantworte jede mit `"A"`, `"B"` oder `"gleich"`. Wähle `"gleich"`,
wenn der Unterschied klein ist, damit nur deutliche Unterschiede zählen.

- **relevanz:** Welche Antwort geht besser auf die Frage ein und auf das, was unter
  `worauf_es_ankommt` steht? Eine Antwort in einer anderen Sprache als der der Person geht
  schlechter darauf ein.
- **richtigkeit:** Welche Antwort ist sachlich richtiger (Recht, Arbeitsmarkt, Bewerbungspraxis)?
  Ein Fehler, der der Person schaden kann, wiegt schwerer als eine Unschärfe.
- **belegtheit:** Welche Antwort stützt sich mehr auf die Angaben der Person und erfindet weniger
  über sie?
- **genug:** Mit welcher Antwort kann die Person ihren nächsten Schritt besser gehen?
- **nicht_zu_viel:** Welche Antwort hat weniger Überflüssiges, etwa Wiederholungen, lange Listen,
  Einleitungen oder zu viele Fragen auf einmal?

## Ablauf

`paare.md` enthält Blöcke `<paar nr="…">` mit `<worauf_es_ankommt>`, dem `<gespraech>` bis zur
letzten Nachricht der Person und den Antworten `<antwort id="A">` und `<antwort id="B">`. Verglichen
wird die Antwort auf die letzte Nachricht im Gespräch.

Arbeite die Paare der Reihe nach ab. Schreibe für jedes Paar zuerst eine Begründung in ein bis zwei
Sätzen, die den wichtigsten Unterschied nennt, dann die fünf Antworten. Hänge nach jeweils etwa zehn
Paaren die Einträge an `bewertung.json` an, damit bei einer Unterbrechung nichts verloren geht. Die
Datei ist ein JSON-Array mit genau einem Eintrag pro Paar:

```json
{
  "nr": 1,
  "begruendung": "B nennt den Kern gleich im ersten Satz, A beginnt mit Lob und stellt drei Fragen.",
  "relevanz": "B",
  "richtigkeit": "gleich",
  "belegtheit": "gleich",
  "genug": "gleich",
  "nicht_zu_viel": "B"
}
```

## Abschluss

Wenn alle Paare bewertet sind, führe im Repo-Wurzelordner aus:

```bash
pnpm soma coach_chat auswerten $ARGUMENTS
```

Meldet der Befehl fehlende Paare, ergänze sie und führe ihn erneut aus. Zeige danach die beiden
Tabellen aus `ergebnis.md` und fasse in zwei, drei Sätzen zusammen, was sich verbessert und was sich
verschlechtert hat. Ändere keine anderen Dateien und committe nichts.
