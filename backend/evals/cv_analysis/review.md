# Prüfung der Beispiele: `cv_analysis`

Geprüft wird nicht das Modell, sondern jedes Beispiel: Ist der Fall fair, ist die Musterlösung
(`gold.json`) richtig, und wirkt er echt? Ablauf mit dem Skill `/beispiele-pruefen cv_analysis`.
Die Beispiele schrieb Claude Opus 5.5; geprüft werden sie von glm-5.3 (high) über z.ai und von
einem Menschen – nie vom Erzeuger oder von einem getesteten Modell (EV-24, EV-25).

## Regeln

- Jeder Fall liegt in `samples/<fall>/`: `cv.pdf` (bekommt das Modell), `gold.json`
  (Musterlösung), `cv.html` (Quelle des PDFs).
- Rolle: genau eine aus frontend, backend, fullstack, mobile, devops, data_ai, qa, ux_ui,
  it_support, it_project, embedded, it_security.
- Station = Stelle, bei der die Person gearbeitet hat (auch Werkstudent, Praktikum,
  wissenschaftliche Mitarbeit). Keine Station: Studium, Ausbildung, Weiterbildung, Projekte.
- Privates darf nicht in die Analyse: Telefon, E-Mail, Adresse, Links, Geburtsdatum,
  Familienstand.
- Kein Lebenslauf: Rolle wird nicht bewertet.

## Fragen

- F1 Ist das ein Lebenslauf? Stimmt `isCv`?
- F2 Welche Rolle passt? Stimmt `role`? Gibt es eine zweite, genauso gute?
- F3 Fehlt in `stations` ein Arbeitgeber, oder steht dort einer zu viel?
- F4 Steht im PDF Privates, das in `contact` fehlt?
- F5 Prüft der Fall, was in `focus` steht?
- F6 Zu einfach? (alles perfekt geordnet, keine Lücke, kein Tippfehler, Rolle steht im Titel)
- F7 Übertriebenes Klischee? (jede Zeile eine Erfolgszahl, Name oder Herkunft passt zum Klischee)
- F8 Verbreiteter Irrtum? (Abschlüsse, Zertifikate, Titel, Aufgaben einer Rolle wie Laien sie
  sich vorstellen)
- F9 Schlicht falsch? (Jahre passen nicht, Technik gab es damals nicht, Abschluss in der Zeit
  unmöglich)
- F10 Urteil: behalten, ändern oder entfernen?

## Über alle Fälle

- G1 Welche Art Lebenslauf fehlt?
- G2 Welche Fälle sind zu leicht?
- G3 Sind viele Fälle gleich gebaut (gleicher Ton, gleiche Erfolgszahlen)?
- G4 Ist die Grenze noch richtig?

## Ergebnisse
