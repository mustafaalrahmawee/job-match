---
name: claude-fassung
description: Erzeugt eine Fassung der Beispiel-Suite coach_chat mit Claude statt über die API. Vier Subagents (Sonnet und Opus, je Effort low und high) beantworten jede Aufgabe parallel. Aufruf mit dem Namen der Fassung, z. B. /claude-fassung v3.
argument-hint: <fassung>
disable-model-invocation: true
model: opus
effort: high
---

# Claude-Fassung · coach_chat

Du leitest die Erzeugung der Fassung **$ARGUMENTS**. Die Antworten schreiben vier Subagents, deren
System-Prompt der Coach-Prompt der App ist. Deine Aufgabe ist, ihnen die Eingaben unverändert zu
geben und ihre Antworten unverändert zu speichern, damit die Fassung zeigt, wie das Modell mit
diesem Prompt antwortet, und nicht, wie du es zusammenfasst.

## 1. Vorbereiten

Führe im Repo-Wurzelordner aus:

```bash
pnpm eval-claude coach_chat vorbereiten $ARGUMENTS
```

Meldet der Befehl veraltete Agent-Dateien oder eine vorhandene Fassung, brich ab und zeige die
Meldung.

## 2. Antworten erzeugen

Lies `backend/evals/coach_chat/fassungen/$ARGUMENTS/eingaben.json`. Jeder Eintrag hat `aufgabe` und
`nachricht`.

Für jeden Eintrag, der Reihe nach:

1. Starte in **einer** Nachricht vier Agent-Aufrufe parallel, mit `subagent_type` `coach-sonnet-low`,
   `coach-sonnet-high`, `coach-opus-low` und `coach-opus-high`. Der `prompt` ist bei allen vier
   genau der Text aus `nachricht`, ohne Zusatz, Einleitung oder Erklärung, damit die Eingabe der
   der App entspricht. Lass sie im Vordergrund laufen.
2. Hänge die vier Ergebnisse an `backend/evals/coach_chat/fassungen/$ARGUMENTS/antworten.json` an,
   ein Objekt pro Antwort:

   ```json
   {
     "aufgabe": "05-language-switch/2",
     "agent": "coach-opus-low",
     "antwort": "…",
     "tokens": 1234,
     "dauer_ms": 5678
   }
   ```

   `antwort` ist der vollständige Text des Subagents, Zeichen für Zeichen. `tokens` und `dauer_ms`
   übernimmst du aus der Nutzungsangabe des Agent-Ergebnisses; fehlen sie, lass die Felder weg.

Bewerte, kürze oder korrigiere die Antworten nicht, auch wenn sie Fehler enthalten; genau diese
Fehler soll die Fassung sichtbar machen.

## 3. Zusammenstellen

Wenn alle Einträge vier Antworten haben, führe aus:

```bash
pnpm eval-claude coach_chat zusammenstellen $ARGUMENTS
```

Meldet der Befehl fehlende Antworten, erzeuge nur diese nach und führe ihn erneut aus. Nenne danach
die geschriebenen Dateien und den Befehl für den Vergleich, z. B.
`pnpm soma coach_chat vorbereiten v2 $ARGUMENTS`. Committe nichts.
