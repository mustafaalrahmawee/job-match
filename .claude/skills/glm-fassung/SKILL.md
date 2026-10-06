---
name: glm-fassung
description: Erzeugt eine neue Fassung der Beispiel-Suite coach_chat über z.ai (GLM, vier Varianten) und bildet die Paare mit der Vorgängerfassung für /soma-bewertung. Aufruf z. B. /glm-fassung v3.
argument-hint: <fassung>
disable-model-invocation: true
---

# GLM-Fassung · coach_chat

Du führst die Schritte aus, mit denen aus dem aktuellen Coach-Prompt die Fassung **$ARGUMENTS**
entsteht. Die Antworten schreibt GLM über z.ai, nicht du. Lies die Antwortdateien der Fassungen
nicht, damit eine spätere Bewertung blind bleibt.

## 1. Prüfen

1. Lies `backend/evals/coach_chat/prompts.json`. Gibt es **$ARGUMENTS** dort schon oder den Ordner
   `backend/evals/coach_chat/fassungen/$ARGUMENTS/`, brich ab und nenne die vorhandenen Fassungen.
   Die letzte Fassung in der Datei ist die **Vorgängerfassung**.
2. Vergleiche ihren `prompt` mit `COACH_CHAT_SYSTEM_PROMPT` in `backend/src/chat/chat.prompts.ts`
   und nenne den geänderten Satz im alten und im neuen Wortlaut. Ist mehr als eine Regel geändert,
   weise darauf hin, denn pro Fassung soll nur eine Änderung gelten. Sind beide gleich, frage, ob ein
   Rauschtest gewollt ist.
3. Frage vor dem Start nach Bestätigung: Der Lauf ruft z.ai auf, dauert etwa zehn Minuten und
   kostet etwa 0,20 $ (Fassung v2: 0,17 $).

## 2. Ausführen

Führe im Repo-Wurzelordner im Hintergrund aus und warte auf das Ende:

```bash
pnpm eval coach_chat $ARGUMENTS
```

Meldet der Befehl einen Fehler, zeige die Meldung und brich ab. Lösche nichts: Ordner und Eintrag in
`prompts.json` können schon angelegt sein, darüber entscheidet die Person.

Zeige danach die Tabelle aus `backend/evals/coach_chat/fassungen/$ARGUMENTS/summary.md` und nenne
auffällige Stopp-Gründe aus `metrics.tsv` (alles außer `end_turn`).

## 3. Paare bilden

```bash
pnpm soma coach_chat vorbereiten <Vorgängerfassung> $ARGUMENTS
```

## Abschluss

Nenne die geschriebenen Ordner und als nächsten Schritt `/soma-bewertung <Vorgängerfassung>-$ARGUMENTS`.
Committe nichts.
