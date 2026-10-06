---
name: claude-fassung
description: Erzeugt zu einer vorhandenen Fassung der Beispiel-Suite coach_chat die Antworten von Claude. Vier Subagents (Sonnet und Opus, je Effort low und high) mit dem Prompt dieser Fassung beantworten jede Aufgabe parallel. Aufruf z. B. /claude-fassung v2.
argument-hint: <fassung>
disable-model-invocation: true
model: opus
effort: high
---

# Claude-Fassung · coach_chat

Du leitest die Claude-Antworten zur Fassung **$ARGUMENTS**. Die Antworten schreiben vier Subagents,
deren System-Prompt der Coach-Prompt dieser Fassung ist. Deine Aufgabe ist, ihnen die Eingaben
unverändert zu geben und ihre Antworten unverändert zu speichern, damit die Fassung zeigt, wie das
Modell mit diesem Prompt antwortet, und nicht, wie du es zusammenfasst.

## 1. Vorbereiten

Führe im Repo-Wurzelordner aus:

```bash
pnpm eval-claude coach_chat vorbereiten $ARGUMENTS
```

Der Befehl schreibt die Agent-Dateien `.claude/agents/coach-*.md` mit dem Prompt von
**$ARGUMENTS** und legt `claude-eingaben.json` an. Meldet er einen Fehler (Fassung fehlt, Claude-
Antworten gibt es schon), brich ab und zeige die Meldung. Claude Code lädt die geänderten
Agent-Dateien nach wenigen Sekunden; lies deshalb erst danach die Eingaben.

## 2. Antworten erzeugen

Lies `backend/evals/coach_chat/fassungen/$ARGUMENTS/claude-eingaben.json`. Jeder Eintrag hat
`aufgabe` und `nachricht`.

Für jeden Eintrag, der Reihe nach:

1. Starte in **einer** Nachricht vier Agent-Aufrufe parallel, mit `subagent_type` `coach-sonnet-low`,
   `coach-sonnet-high`, `coach-opus-low` und `coach-opus-high`. Der `prompt` ist bei allen vier
   genau der Text aus `nachricht`, ohne Zusatz, Einleitung oder Erklärung, damit die Eingabe der
   der App entspricht. Lass sie im Vordergrund laufen.
2. Hänge die vier Ergebnisse an
   `backend/evals/coach_chat/fassungen/$ARGUMENTS/claude-antworten.json` an, ein Objekt pro Antwort:

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

Bewerte, kürze oder korrigiere die Antworten nicht, auch wenn sie Fehler oder Anmerkungen an dich
enthalten; genau das soll die Fassung sichtbar machen.

## 3. Zusammenstellen

Wenn alle Einträge vier Antworten haben, führe aus:

```bash
pnpm eval-claude coach_chat zusammenstellen $ARGUMENTS
```

Meldet der Befehl fehlende Antworten, erzeuge nur diese nach und führe ihn erneut aus. Nenne danach
die geschriebenen Dateien. Committe nichts.
