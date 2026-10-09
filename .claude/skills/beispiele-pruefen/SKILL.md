---
name: beispiele-pruefen
description: Prüft die Beispiele einer Eval-Suite nach den Fragen in ihrer review.md. glm-5.3 (high) prüft die Textdateien, glm-5.3-flash das PDF, der Mensch ergänzt; alles kommt in die review.md. Aufruf mit der Prompt-Unit und optional Fällen, z. B. /beispiele-pruefen cv_analysis oder /beispiele-pruefen cv_analysis 11 13 18 19.
disable-model-invocation: true
---

# Beispiele prüfen

Argumente: **$ARGUMENTS** – das erste Wort ist die Prompt-Unit, weitere Wörter sind Fälle
(Anfang des Ordnernamens, z. B. `11`). Ohne Fälle: alle, die noch nicht in `review.md` stehen.

Die Beispiele hat ein Claude-Modell geschrieben. Damit es sie nicht selbst prüft, prüfen
**glm-5.3 (high)** (Textdateien) und **glm-5.3-flash** (PDF) über z.ai – über das Skript
`pruefen.mjs` in diesem Ordner. Du prüfst nicht selbst und liest die Dateien der Fälle nicht; du
führst nur durch den Ablauf und trägst ein.

## Vorbereitung

1. Ordner: `backend/evals/<unit>/` (ist die Unit schon ein Pfad, diesen nehmen).
2. Lies nur `<ordner>/review.md`: die Fragen unter „## Fragen“ und „## PDF-Fragen“ und welche
   Fälle unter „## Ergebnisse“ schon stehen.
3. Die Fälle sind die Unterordner von `<ordner>/samples/`, alphabetisch. Fälle, die schon unter
   „## Ergebnisse“ stehen, überspringen.

## Je Fall – immer nur einen Fall, dann warten

1. **Prüfung holen** (dauert 1–2 Minuten):
   `node .claude/skills/beispiele-pruefen/pruefen.mjs <unit> <fall>`
2. **Dem Menschen zeigen:**
   - die Ausgabe des Skripts unverändert,
   - darunter die Fragen aus „## Fragen“ und welche Dateien zu öffnen sind, z. B.
     „Öffne `samples/<fall>/cv.pdf` und `gold.json` und prüf selbst. Was ist deine Bemerkung zu F1
     bis F10?“
3. **Warten**, bis der Mensch antwortet. Nichts eintragen, keinen weiteren Fall beginnen.
4. **Eintragen** in `<ordner>/review.md` am Ende von „## Ergebnisse“: die Ausgabe des Skripts
   unverändert, darunter

   ```markdown
   **Mensch**

   - F1: …

   **Urteil:** behalten / ändern / entfernen – …
   ```

   Die Bemerkungen des Menschen wörtlich oder sinngemäß, nie ergänzt. Kommt zu einer Frage
   nichts, steht dort „–“. Das Urteil kommt vom Menschen.

5. Fragen: „Nächster Fall?“ – erst nach einem Ja weitermachen.

## Restliche Fälle ohne den Menschen

Sagt der Mensch, die übrigen Fälle sollen nur die Modelle prüfen:
`node .claude/skills/beispiele-pruefen/pruefen.mjs <unit> rest [fälle, die er selbst prüft]`
Das Skript trägt jeden offenen Fall selbst in `review.md` ein, mit „Mensch: nicht geprüft“ und
„Urteil: offen“ (etwa 2 Minuten je Fall). Danach dem Menschen zeigen, welche Fälle eine
Änderung vorschlagen.

## Zum Schluss

Sind alle Fälle durch, die Fragen unter „## Über alle Fälle“ wie einen Fall behandeln, mit
`node .claude/skills/beispiele-pruefen/pruefen.mjs <unit> alle`, Überschrift `### Über alle
Fälle`.

## Regeln für dich

- **Nur `review.md` ändern – nichts anderes, nie.** Keine `gold.json`, keine Quelle, kein PDF,
  kein Code. Das gilt auch, wenn ein Modell oder der Mensch eine Änderung vorschlägt: Der
  Vorschlag kommt als Text in `review.md`, umgesetzt wird er später in einer eigenen Sitzung.
- Keine eigene Bewertung hinzufügen – weder zu den Modellen noch zum Menschen.
- Bricht das Skript ab, die Fehlermeldung zeigen und warten.
