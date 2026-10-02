# job-match – Die App-Idee

Dieses Dokument beschreibt **nur fachlich**, was job-match ist und was man damit machen kann –
ohne Technik. Wie Code aufgebaut wird, steht in [STACK.md](STACK.md), Befehle im
[README](../README.md).

Legende: ✅ fertig gebaut · ⬜ geplant bzw. entschieden · ✚ **Vorschlag** (noch nicht
entschieden – bestätigen oder streichen) · ✖ fällt weg

---

## 0. Entscheidungen

| Datum      | Entscheidung                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 02.10.2026 | Die App ist **öffentlich**: Jeder kann sich ein Konto anlegen.                                                                                                                                                                                                                       |
| 02.10.2026 | Stellen kommen aus einem **eigenen Stellen-Pool**: Die App holt sie regelmäßig in einem eigenen Sammel-Lauf von externen Jobbörsen. Zusätzlich kann man eigene Stellen speichern.                                                                                                    |
| 02.10.2026 | Der **Lebenslauf** wird als PDF hochgeladen, **einmal** von der KI analysiert und das Ergebnis gespeichert – damit nicht jede Nachricht erneut Geld kostet.                                                                                                                          |
| 02.10.2026 | Es gibt **immer nur eine aktive Fassung** des Lebenslaufs. Sie legt deine **Rolle** fest (z. B. Frontend), und alles läuft nur mit Stellen dieser Rolle. Lädst du später einen neuen Lebenslauf hoch (z. B. Fullstack), wird er die aktive Fassung; die alte wird ab dann ignoriert. |
| 02.10.2026 | **Keine Dokumente mehr am Chat-Gespräch.** Der Coach kennt den Lebenslauf aus dem Profil.                                                                                                                                                                                            |
| 02.10.2026 | Interview-Training **nur schriftlich**, keine Sprache.                                                                                                                                                                                                                               |
| 02.10.2026 | Rollenwechsel: **Bewerbungen** der alten Rolle bleiben sichtbar, **Match-Ergebnisse** der alten Fassung gehen ins **Archiv**. Eine alte Fassung kann man **wieder aktiv** machen.                                                                                                    |
| 02.10.2026 | Auch ein neuer Lebenslauf **mit gleicher Rolle** (z. B. nur eine neue Station) ersetzt die alte Fassung.                                                                                                                                                                             |
| 02.10.2026 | Kosten: In der Entwicklungsphase ist die App **kostenlos mit Nutzungslimit**.                                                                                                                                                                                                        |
| 02.10.2026 | Der Stellen-Pool deckt **nur Deutschland** ab.                                                                                                                                                                                                                                       |
| 02.10.2026 | **Rolle:** Die KI schlägt sie nach der Analyse vor, du bestätigst oder wählst eine andere – aus einer **festen Liste** von Berufen.                                                                                                                                                  |
| 02.10.2026 | Das **Original-PDF** des Lebenslaufs bleibt gespeichert (ansehen, herunterladen).                                                                                                                                                                                                    |
| 02.10.2026 | Rollenwechsel: **Interview-Trainings und Chats** der alten Rolle bleiben sichtbar.                                                                                                                                                                                                   |
| 02.10.2026 | Die App ist auf Deutsch, versteht aber auch **englische** Lebensläufe und Stellenanzeigen.                                                                                                                                                                                           |

---

## 1. In einem Satz

job-match begleitet dich **von der Stellenanzeige bis zur Zusage**: Die App zeigt dir passende
Stellen und wie gut du zu ihnen passt, hilft dir bei deinen Unterlagen, trainiert mit dir das
Vorstellungsgespräch und behält alle deine Bewerbungen im Blick.

## 2. Für wen und welches Problem

**Für wen:** Alle, die sich gerade aktiv bewerben – Berufseinsteiger, Jobwechsler,
Quereinsteiger. Die App ist öffentlich, jeder kann sich registrieren.

**Das Problem heute:**

- Du weißt nicht, ob dein Lebenslauf wirklich zu einer Stelle passt – und wo nicht.
- Du suchst auf vielen Jobbörsen und musst jede Anzeige selbst gegen deinen Lebenslauf lesen.
- Lücken (fehlende Erfahrung, Zeiten ohne Job, fehlende Zertifikate) musst du im Gespräch
  erklären, bist aber nicht darauf vorbereitet.
- Vorstellungsgespräche übt man selten, und niemand gibt ehrliches Feedback.
- Bei vielen Bewerbungen gleichzeitig verlierst du den Überblick: Wo habe ich mich beworben?
  Wann muss ich nachfragen? Mit wem habe ich telefoniert?

**Die Lösung:** Ein Ort für alles. Du lädst deinen Lebenslauf **einmal** hoch, die KI analysiert
ihn **einmal**, und jede Funktion baut auf dieser Analyse auf.

---

## 3. Die Bausteine – was du in der App hast

| Baustein               | Was das ist                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Konto**              | Dein Zugang. Alles in der App gehört nur dir.                                                                        |
| **Lebenslauf-Fassung** | Ein hochgeladener Lebenslauf (PDF) samt gespeicherter KI-Analyse. Immer nur **eine aktiv**, ältere liegen im Archiv. |
| **Rolle**              | Deine Zielrolle (z. B. Frontend). Kommt aus der aktiven Fassung.                                                     |
| **Profil**             | Deine aktive Fassung, deine Rolle und deine Wünsche (Ort, Gehalt …).                                                 |
| **Stellen-Pool**       | Stellen, die die App regelmäßig von externen Jobbörsen holt.                                                         |
| **Stelle**             | Eine Stellenanzeige – aus dem Pool oder von dir selbst gespeichert.                                                  |
| **Match-Analyse**      | Wie gut passt die aktive Fassung zu einer Stelle: Score, Stärken, Lücken, Tipps.                                     |
| **Bewerbung**          | Deine Bewerbung auf eine Stelle – mit Status, Verlauf, Notizen und Terminen.                                         |
| **Notiz**              | Ein freier Eintrag zu einer Bewerbung („HR-Telefonat, Gehalt 55k genannt“).                                          |
| **Interview-Training** | Ein schriftlich geübtes Vorstellungsgespräch zu einer Stelle, mit Feedback.                                          |
| **Coach-Chat**         | Ein Chat mit einem Karriere-Coach, der deinen Lebenslauf kennt.                                                      |
| **Unterlagen**         | Anschreiben und andere erzeugte Dateien.                                                                             |
| **Termin**             | Ein Vorstellungsgespräch im Kalender.                                                                                |

**So hängen sie zusammen:**

```
Lebenslauf-PDF ──► KI-Analyse (einmal, gespeichert) ──► aktive Fassung + Rolle (alte Fassungen: Archiv)
                                                                │
Externe Jobbörsen ──► Stellen-Pool ──┐                          │
Eigene Stelle ───────────────────────┴──► Stelle ◄──── Match-Analyse (Score, Stärken, Lücken, Tipps)
                                            │
                                            ▼
                                        Bewerbung ───► Status + Verlauf · Notizen · Termine · Unterlagen
                                            │
                                            ▼
                                   Interview-Training ───► Bewertung je Antwort · Abschlussbericht

Coach-Chat: daneben, jederzeit – kennt deine Lebenslauf-Analyse (und später deine Bewerbungen)
```

---

## 4. Was du tun kannst – Bereich für Bereich

### 4.1 Konto

- ⬜ Anmelden und abmelden.
- ⬜ **Registrieren für alle** (heute nur, wenn freigeschaltet).
- ⬜ Passwort ändern.
- ⬜ **Konto löschen** – dabei verschwinden **alle** Daten (Lebenslauf, Bewerbungen, Chats).
  Bei einer öffentlichen App mit Lebensläufen Pflicht (Datenschutz).
- ⬜ **Eigene Daten herunterladen** (Datenschutz-Auskunft).
- ✚ Passwort vergessen → Link per E-Mail.
- ✚ E-Mail-Adresse bei der Registrierung bestätigen.
- ⬜ **Kostenlos mit Nutzungslimit pro Konto** (z. B. Analysen oder Nachrichten pro Tag), damit
  eine öffentliche App die KI-Kosten nicht sprengt. Gilt für die Entwicklungsphase; ein
  Bezahlmodell ist später möglich.
- ✚ Du siehst, wie viel von deinem Limit heute noch übrig ist.

### 4.2 Mein Profil und Lebenslauf

- ⬜ Lebenslauf als **PDF hochladen** – auf Deutsch oder Englisch.
- ⬜ Das Original-PDF bleibt gespeichert: Du kannst es jederzeit ansehen und herunterladen.
- ⬜ Die KI analysiert ihn **einmal** – ähnlich wie heute im Chat: Stationen, Fähigkeiten,
  Ausbildung, Sprachen, dazu Stärken, Schwächen und Verbesserungstipps.
- ⬜ Die Analyse wird **gespeichert**. Jede weitere Funktion (Match, Chat, Training) nutzt diese
  gespeicherte Analyse, statt das PDF jedes Mal neu zu schicken – das spart Geld.
- ⬜ **Immer nur eine aktive Fassung.** Sie legt deine **Rolle** fest (z. B. Frontend). Match,
  Job-Empfehlungen, Stellen-Pool, Training und Chat arbeiten **nur** mit dieser Fassung und nur
  mit Stellen dieser Rolle.
- ⬜ **Rolle:** Die KI **schlägt** nach der Analyse eine Rolle **vor**, du
  **bestätigst** sie oder wählst eine andere. Die Rolle kommt aus einer **festen Liste** von
  Berufen, damit sie zu den Stellen im Pool passt.
- ⬜ **Neue Fassung hochladen** – bei neuer Rolle (z. B. später Fullstack) **und** bei gleicher
  Rolle (z. B. nur eine neue Station): Sie wird einmal analysiert und ist ab sofort die aktive
  Fassung. Die alte Fassung wird ab dann **ignoriert**.
- ⬜ Alte Fassungen liegen im **Archiv**: sichtbar, aber nirgends mehr benutzt.
- ⬜ Eine alte Fassung **wieder aktiv** machen – ohne neues Hochladen und ohne neue Analyse (die
  gespeicherte Analyse wird wiederverwendet). Ihre Rolle gilt dann wieder.
- ✚ Beim Reaktivieren kommen auch die archivierten Match-Ergebnisse dieser Fassung zurück.
- ✚ Fehler in der Analyse von Hand korrigieren (z. B. eine falsch erkannte Station).
- ✚ Wünsche festhalten: Ort, Remote ja/nein, Gehaltsvorstellung, frühester Start.
  Daran orientieren sich Tipps und Job-Empfehlungen.

### 4.3 Stellen

- ⬜ **Stellen-Pool**: Die App holt regelmäßig Stellen **aus Deutschland** von externen Jobbörsen und
  legt sie bei sich ab. Du siehst nur Stellen **deiner Rolle** und filterst darin (Titel, Ort, Remote …).
- ⬜ Stellenanzeigen auf Deutsch oder Englisch.
- ⬜ **Eigene Stelle** speichern: Anzeigentext einfügen oder **Screenshot** der Anzeige hochladen –
  die App liest den Text daraus. Für Anzeigen, die nicht im Pool sind.
- ⬜ Zu einer Stelle gehören Titel, Firma, Ort, Text und Quelle (Link zur Originalanzeige).
- ⬜ Infos zur Firma aus dem Web holen (Was macht die Firma? Aktuelle Neuigkeiten?).
- ✚ Stellen merken, ohne sich gleich zu bewerben (Merkliste).
- ✚ Abgelaufene Stellen im Pool werden als „nicht mehr ausgeschrieben“ markiert.

### 4.4 Match-Analyse

- ⬜ Aktive Fassung + Stelle → **Score 0–100**, **Stärken**, **Lücken**, **Tipps**.
- ⬜ Stärken und Lücken beziehen sich auf konkrete Angaben aus Lebenslauf und Anzeige.
- ⬜ Gründliche Bewertung: Die App „denkt“ vorher nach.
- ⬜ Das Ergebnis wird gespeichert und nicht jedes Mal neu berechnet.
- ⬜ Mehrere Stellen auf einmal prüfen → Liste sortiert nach Score.
- ⬜ Nachfragen zum Ergebnis im Chat („Warum nur 62?“).
- ⬜ Wird die Fassung ersetzt, gehen ihre Match-Ergebnisse ins **Archiv**.
- ✚ Tipps sind zweigeteilt: **„Lebenslauf anpassen“** und **„So erklärst du die Lücke im
  Gespräch“**.

### 4.5 Bewerbungen (dein Überblick)

- ⬜ Aus einer Stelle eine Bewerbung machen.
- ⬜ Status setzen: `gemerkt` → `beworben` → `Interview` → `Angebot` | `Absage` |
  `zurückgezogen`.
- ⬜ Jeder Statuswechsel wird mit Datum gespeichert (Verlauf: „beworben am 3.10., Interview am
  15.10.“).
- ⬜ Liste aller Bewerbungen mit Status; Status direkt dort ändern.
- ⬜ Der Coach kann im Chat Status setzen („Setz Firma X auf Interview“).
- ⬜ Freie **Notizen** pro Bewerbung.
- ⬜ Bewerbungen bleiben **sichtbar**, auch wenn du die Rolle wechselst – es sind echte
  Bewerbungen. Ebenso Interview-Trainings und Chats der alten Rolle.
- ✚ Jede Notiz mit Datum, chronologisch – wie ein Tagebuch zur Bewerbung.
- ✚ Notizen fließen ins Interview-Training ein („Im ersten Gespräch ging es viel um SQL“).
- ✚ Festhalten, **mit welcher Fassung** du dich beworben hast.
- ✚ **Kontaktpersonen** pro Bewerbung (Name, Rolle, E-Mail).
- ✚ **Wiedervorlage**: „Nachfassen in 7 Tagen“ – die App erinnert dich.
- ✚ Ansicht als **Board** (Spalten nach Status) zusätzlich zur Liste; Filter nach Status.

### 4.6 Interview-Training (nur schriftlich)

- ⬜ Training für eine gespeicherte Stelle starten: Anzahl Fragen und Schwierigkeit wählen.
- ⬜ Der Bot stellt eine Frage, du **schreibst** deine Antwort, er bewertet (Punkte + kurzes
  Feedback), dann die nächste Frage.
- ⬜ Mittendrin abbrechen; später **fortsetzen**, auch nach einem Neuladen.
- ⬜ Abschlussbericht: Stärken, Verbesserungen, Gesamtnote.
- ⬜ Typische Fragen für deinen Beruf aus einer Wissenssammlung.
- ⬜ Lange Trainings laufen ohne Abbruch durch.
- ✚ Fragen zielen gezielt auf die **Lücken aus der Match-Analyse**.
- ✚ Art der Fragen wählbar: fachlich, Verhalten („Erzählen Sie von einem Konflikt …“),
  Motivation.
- ✚ Fortschritt über mehrere Trainings sehen (Gesamtnote 1. Training vs. 3. Training).

### 4.7 Coach-Chat

- ⬜ Freie Fragen rund um Bewerbung und Karriere; der Bot verhält sich wie ein Karriere-Coach.
- ⬜ Antworten erscheinen Wort für Wort; du kannst jederzeit **stoppen**.
- ⬜ Mehrere Gespräche, gespeichert; umbenennen und löschen (mit Rückfrage).
- ⬜ Antwort-Qualität wählen: **Normal** oder **Erweitert**, Gründlichkeit **Niedrig** oder
  **Hoch**.
- ⬜ Hinweis, wenn eine Antwort abgeschnitten wurde; „Erneut versuchen“ bei Fehlern.
- ✖ Dokumente (Text/PDF) an ein Gespräch hängen – **entfernt** (02.10.2026), ersetzt durch den Lebenslauf
  im Profil.
- ✖ Belegstellen als Fußnoten – **entfernt** (02.10.2026).
- ⬜ Der Coach **kennt die Analyse deiner aktiven Fassung** automatisch – du musst nichts anhängen.
- ⬜ Der Coach **handelt** im Chat: Stelle speichern, Status setzen, Interviewfragen erzeugen,
  Firma recherchieren – du siehst dabei, was er gerade tut.
- ⬜ Später: den Gedankengang des Coaches anzeigen.
- ✚ Der Coach kennt auch deine Bewerbungen und Notizen.

### 4.8 Job-Empfehlungen

- ⬜ „Finde die 5 besten Jobs für mich“: die passendsten Stellen **aus dem Stellen-Pool** zu
  deiner aktiven Fassung und Rolle, mit Begründung.
- ⬜ Begründung mit Quellen (welche Anzeige, welche Anforderung).
- ✚ Berücksichtigt deine Wünsche aus dem Profil (Ort, Remote, Gehalt).
- ✚ Neue passende Stellen seit deinem letzten Besuch hervorheben.

### 4.9 Unterlagen

- ⬜ **Anschreiben** passend zu Stelle und aktiver Fassung erzeugen und als Word-Datei herunterladen.
- ✚ Unterlagen einer Bewerbung zuordnen („dieses Anschreiben ging an Firma X“).

### 4.10 Termine

- ⬜ Interviewtermine in deinen Kalender eintragen und anzeigen.
- ✚ Vor einem Termin: Hinweis „Interview in 2 Tagen – jetzt trainieren?“.

### 4.11 Startseite (Übersicht) ✚

- ✚ Auf einen Blick: Bewerbungen nach Status, nächste Termine, fällige Wiedervorlagen, neue
  passende Stellen, letzte Match-Scores.

---

## 5. Ein typischer Ablauf

1. Du registrierst dich und lädst deinen **Lebenslauf als PDF** hoch. Die KI analysiert ihn einmal;
   du siehst Fähigkeiten, Stationen und Verbesserungstipps. Deine **Rolle** ist jetzt „Frontend“.
2. Unter **Job-Empfehlungen** zeigt dir die App die 5 passendsten Frontend-Stellen aus dem Pool.
3. Die **Match-Analyse** zu einer Stelle sagt: 68 von 100. Stark bei Vue und TypeScript, Lücke bei
   Kubernetes. Tipp: Projekt X im Lebenslauf nach oben, im Gespräch Lernbereitschaft zeigen.
4. Du lässt ein **Anschreiben** erzeugen und bewirbst dich. Die **Bewerbung** steht auf
   „beworben“.
5. HR ruft an – du schreibst eine **Notiz**, die App trägt den **Termin** ein, Status → „Interview“.
6. Du machst zwei schriftliche **Interview-Trainings**, die Fragen zielen auf die
   Kubernetes-Lücke. Note von 2,8 auf 1,9.
7. Nach dem Gespräch: Status → „Angebot“. Im **Coach-Chat** fragst du, wie du das Gehalt
   verhandelst – der Coach kennt deinen Lebenslauf schon.
8. Ein Jahr später willst du in Richtung Fullstack. Du lädst einen **neuen Lebenslauf** hoch. Ab
   jetzt ist deine Rolle „Fullstack“: Empfehlungen, Pool, Match und Coach arbeiten nur noch mit
   der neuen Fassung, die alte wird ignoriert.

---

## 6. Was die App bewusst **nicht** macht

- ⬜ Kein Interview-Training per Sprache – nur schriftlich.
- ✚ Sich **nicht** selbst für dich bewerben oder Mails an Firmen schicken.
- ✚ Deine Daten **nicht** an Arbeitgeber oder Dritte weitergeben.
- ✚ Keine Jobbörse für Arbeitgeber: Firmen können keine eigenen Anzeigen einstellen. Die Stellen
  kommen aus externen Jobbörsen oder von dir.

---

## 7. Fachliche Roadmap

Die Stufen entsprechen [STUFEN.md](STUFEN.md) (dort mit Technik und Claude-Thema je Stufe); hier
steht nur, **was du danach kannst**. ✚-Punkte sind einer Stufe zugeordnet, die mir passend
erscheint – zu bestätigen.

> **Neustart (02.10.2026):** Die App wird mit Express von null neu gebaut, beginnend mit Stufe 0.
> Konto und Coach-Chat kommen in Stufe 1.

| Stufe   | Danach kannst du …                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0       | – (Fundament, noch nichts für Nutzer)                                                                                                                         |
| 1       | dich anmelden, mit dem Coach chatten, Gespräche verwalten                                                                                                     |
| 2       | **Lebenslauf als PDF hochladen**, einmal analysieren lassen, Rolle bestätigen, neue Fassung hochladen, alte reaktivieren (Archiv); Coach kennt den Lebenslauf |
|         | ✚ Wünsche im Profil                                                                                                                                           |
| 3       | eigene Stellen anlegen (auch per Screenshot), **Match-Analyse** sehen                                                                                         |
|         | ✚ zweigeteilte Tipps                                                                                                                                          |
| 4       | **Bewerbungen** mit Status und Verlauf führen, **Notizen** schreiben, Coach handelt im Chat, Firma recherchieren                                              |
|         | ✚ Kontakte, ✚ Wiedervorlage, ✚ Board-Ansicht, ✚ Startseite                                                                                                    |
| 5       | schriftliches **Interview-Training** mit Bewertung und Abschlussbericht                                                                                       |
|         | ✚ Fragen auf Lücken, ✚ Fragenart wählen                                                                                                                       |
| 6       | Trainings und Chats beliebig lang führen und später fortsetzen                                                                                                |
|         | ✚ Fortschritt über mehrere Trainings                                                                                                                          |
| 7       | im **Stellen-Pool** suchen (regelmäßig von externen Jobbörsen geholt, nur Deutschland), **Job-Empfehlungen** „Top 5 für mich“, typische Fragen je Beruf       |
| 8       | **Anschreiben** als Word-Datei, **Termine** im Kalender                                                                                                       |
| Go-live | öffentlich registrieren, Passwort ändern, **Konto löschen**, **Daten herunterladen**; **Nutzungslimit**; ✚ Passwort vergessen, ✚ E-Mail bestätigen            |

> **Hinweis:** Die Go-live-Punkte müssen fertig sein, **bevor** die App öffentlich wird – egal, nach
> welcher Stufe das passiert.

---

## 8. Offene Fragen

1. **Welche ✚-Vorschläge** kommen rein, welche fliegen raus? (Kann warten.)
