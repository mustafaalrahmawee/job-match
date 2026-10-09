---
name: beispiele-pruefen
description: Prüft die Beispiele einer Eval-Suite gemeinsam mit dem Menschen, Fall für Fall, nach den Fragen in ihrer review.md. Die Prüfung macht glm-5.3 (high) über z.ai, nicht der Chat-Agent; beide Ergebnisse kommen in die review.md. Aufruf mit der Prompt-Unit, z. B. /beispiele-pruefen cv_analysis.
disable-model-invocation: true
---

# Beispiele prüfen

Prompt-Unit: **$ARGUMENTS**

Die Beispiele hat ein Claude-Modell geschrieben. Damit es sie nicht selbst prüft, prüft
**glm-5.3 (high)** über z.ai – über das Skript `pruefen.mjs` in diesem Ordner. Du prüfst nicht
selbst und liest die Dateien der Fälle nicht; du führst nur durch den Ablauf und trägst ein.

## Vorbereitung

1. Ordner: `backend/evals/$ARGUMENTS/` (ist das Argument schon ein Pfad, diesen nehmen).
2. Lies nur `<ordner>/review.md`: die Fragen unter „## Fragen“ und welche Fälle unter
   „## Ergebnisse“ schon stehen.
3. Die Fälle sind die Unterordner von `<ordner>/samples/`, alphabetisch. Fälle, die schon unter
   „## Ergebnisse“ stehen, überspringen.

## Je Fall – immer nur einen Fall, dann warten

1. **Prüfung holen:**
   `node .claude/skills/beispiele-pruefen/pruefen.mjs $ARGUMENTS <fall>`
2. **Dem Menschen zeigen:**
   - die Ausgabe von glm-5.3 unverändert,
   - darunter die Fragen aus „## Fragen“ und welche Dateien zu öffnen sind, z. B.
     „Öffne `samples/<fall>/cv.pdf` und `gold.json` und prüf selbst. Was ist deine Bemerkung zu F1
     bis F10?“
   - den Hinweis: glm-5.3 liest keine PDFs, nur die Textdateien; was nur im PDF zu sehen ist
     (Scan, Textebene, Layout), prüft der Mensch.
3. **Warten**, bis der Mensch antwortet. Nichts eintragen, keinen weiteren Fall beginnen.
4. **Eintragen** in `<ordner>/review.md` am Ende von „## Ergebnisse“:

   ```markdown
   ### <fall>

   **glm-5.3 (high)**

   - F1: …

   **Mensch**

   - F1: …

   **Urteil:** behalten / ändern / entfernen – …
   ```

   Die Ausgabe von glm-5.3 und die Bemerkungen des Menschen wörtlich oder sinngemäß, nie ergänzt.
   Kommt zu einer Frage nichts, steht dort „–“. Das Urteil kommt vom Menschen.

5. Fragen: „Nächster Fall?“ – erst nach einem Ja weitermachen.

## Zum Schluss

Sind alle Fälle durch, die Fragen unter „## Über alle Fälle“ genauso behandeln, mit
`node .claude/skills/beispiele-pruefen/pruefen.mjs $ARGUMENTS alle`, Überschrift `### Über alle
Fälle`.

## Regeln für dich

- Nur `review.md` ändern. Beispiele, Gold-Dateien und Code bleiben, wie sie sind.
- Keine eigene Bewertung hinzufügen – weder zu glm-5.3 noch zum Menschen.
- Bricht das Skript ab, die Fehlermeldung zeigen und warten.
