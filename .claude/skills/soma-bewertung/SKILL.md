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
2. Lies nur `backend/evals/coach_chat/soma-fragen.md` und `paare.md` und schreibe nur
   `bewertung.json`. Öffne `schluessel.json`, den Ordner
   `fassungen/` und andere Vergleiche nicht, damit der Vergleich blind bleibt.

## Die fünf Fragen

Lies zuerst `backend/evals/coach_chat/soma-fragen.md`, bevor du `paare.md` öffnest, damit du jedes
Paar schon mit den Fragen im Kopf liest. Dieselbe Datei nutzt auch der GLM-Bewerter, so gelten für
beide Bewerter dieselben Fragen.

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
pnpm soma coach_chat auswerten $ARGUMENTS "<dein Modellname>"
```

Setze deinen tatsächlichen Modellnamen ein (z. B. `claude-opus-5-5` oder `glm-5.3`), damit
`ergebnis.md` den richtigen Bewerter nennt.

Meldet der Befehl fehlende Paare, ergänze sie und führe ihn erneut aus. Zeige danach die beiden
Tabellen aus `ergebnis.md` und fasse in zwei, drei Sätzen zusammen, was sich verbessert und was sich
verschlechtert hat. Ändere keine anderen Dateien und committe nichts.
