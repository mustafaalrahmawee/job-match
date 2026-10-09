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

## PDF-Fragen

- P1 Stehen Rolle, Arbeitgeber und Zeiträume aus `gold.json` lesbar im PDF?
- P2 Fällt an Layout oder Lesbarkeit etwas auf, das ein Modell verwirren könnte (Spalten,
  Reihenfolge, Scan-Qualität)?
- P3 Wirkt das PDF wie ein echtes Dokument?

## Über alle Fälle

- G1 Welche Art Lebenslauf fehlt?
- G2 Welche Fälle sind zu leicht?
- G3 Sind viele Fälle gleich gebaut (gleicher Ton, gleiche Erfolgszahlen)?
- G4 Ist die Grenze noch richtig?

## Ergebnisse

### 01-frontend-de

**glm-5.3 (high)**

- F1: Ja, klassischer Lebenslauf („Lebenslauf Lea Hoffmann", Profil, Berufserfahrung, Ausbildung, Kenntnisse); `isCv: true` stimmt.
- F2: `frontend` passt eindeutig (Untertitel „Frontend-Entwicklerin", Vue/React/Storybook/Cypress); eine zweite gleichwertige Rolle gibt es nicht, Fullstack wird nirgends belegt.
- F3: Alle drei Arbeitgeber stehen korrekt in `stations` (Pixelwerk, Sonnenfeld, Lindgrün inkl. Werkstudentenstelle); das Studium an der HTW ist zu Recht keine Station – nichts fehlt, nichts zu viel.
- F4: Ja, klein: die Adresse ist im PDF „Gneisenaustraße 41, 10961 Berlin", in `contact` steht nur „Gneisenaustraße 41" – PLZ und Stadt fehlen; sonst (Telefon, E-Mail, GitHub) vollständig.
- F5: Ja, der Fall prüft genau den Fokus: durchgängiger Frontend-Werdegang („Werkstudentin Webentwicklung" → „Junior-Webentwicklerin" → „Frontend-Entwicklerin") ohne Rollenwechsel.
- F6: Eher ja: Rolle steht im Untertitel („Frontend-Entwicklerin"), zeitlich lückenlos rückwärts sortiert (04/2018–08/2019, 09/2019–02/2022, 03/2022–heute), kein Tippfehler – als Gruppenfall „typical" vertretbar, aber an der leichten Seite.
- F7: Nein, kein Overkill: nur zwei von acht Bullets enthalten Zahlen („genutzt von vier Produktteams", „Build-Zeit von 4 Minuten auf 40 Sekunden"), der Rest ist qualitativ; Name/Berlin-Umfeld sind unauffällig plausibel.
- F8: Nein, keine Laienfehler: Storybook, Vite-Migration, Cypress/Lighthouse in CI, „WCAG 2.1 AA" und ein Medieninformatik-B.Sc. mit Frontend-Thesis („Ladezeiten von Single-Page-Anwendungen") entsprechen realer Frontend-Praxis.
- F9: Nein, Zahlen und Technik passen: Studium 2015–2019 mit Werkstudentenstelle ab 04/2018, Vue 3/Pinia/Vite erst ab 03/2022 eingesetzt (Vue 3 стаб. 2020), „gut sieben Jahren Erfahrung" passt zu Beginn 04/2018.
- F10: Behalten – einzig `contact` um „10961 Berlin" ergänzen, damit die Adresse vollständig ist.

**Mensch**

- F1: Ja.
- F2: Rolle `frontend` richtig. Kleinigkeit: als Junior-Webentwicklerin Redaktions-Oberflächen mit React und TypeScript, als Frontend-Entwicklerin eine Vue-3-Komponentenbibliothek – beides Frontend (JavaScript/TypeScript, Bibliothek oder Framework), aber eine Stelle mit React, die andere mit Vue.js. Ist das okay?
- F3: wie glm-5.3.
- F4: wie glm-5.3.
- F5: wie glm-5.3.
- F6: wie glm-5.3.
- F7: wie glm-5.3.
- F8: wie glm-5.3.
- F9: wie glm-5.3.
- F10: Hängt an der Bemerkung zu F2 – anpassen, oder ist der Wechsel zwischen Frontend-Frameworks okay, weil wer React versteht, Vue.js leicht versteht?

**Urteil:** behalten – keine Änderung; der Wechsel von React zu Vue ist realistisch, die Rolle bleibt frontend; „10961 Berlin“ kommt nicht in `contact`.

### 02-backend-en

**glm-5.3 (high)**

- F1: Ja, eindeutig ein Lebenslauf (Abschnitte „SUMMARY", „EXPERIENCE", „EDUCATION", „SKILLS"); `isCv: true` stimmt.
- F2: `backend` passt: „Backend engineer with ten years of experience designing and running high-volume services on the JVM" und Titel „Senior Backend Engineer"; keine zweite gleichwertige Rolle, da weder Frontend noch Mobile/DevOps/Data-Anteile vorkommen.
- F3: Weder fehlt noch steht einer zu viel: alle drei Arbeitgeber („Kestrel Payments GmbH", „Harbourline Logistics Ltd", „Brightwater Systems Ltd") sind mit korrekten Daten erfasst, das Studium („BSc Computer Science, University of Leeds, 2013 – 2016") ist zu Recht keine Station.
- F4: Ja, teilweise: im CV steht „Wrangelstraße 88, 10997 Berlin, Germany", in `contact` aber nur „Wrangelstraße 88" – PLZ und Ort fehlen; E-Mail, Telefon und „linkedin.com/in/danielokafor" sind erfasst.
- F5: Ja, der Fall prüft genau den Fokus: Rolle („Senior Backend Engineer – Kestrel Payments GmbH, Berlin"), Sprache (durchgängig englisch) und Ort (Adresse „10997 Berlin") sind abgedeckt.
- F6: Eher einfach: lückenlose Zeitlinie („09/2016 – 05/2019", „06/2019 – 12/2022", „01/2023 – present"), keine Tippfehler, Rolle wörtlich in Summary und Jobtiteln – für die Gruppe „typical" noch als saubere Basis vertretbar.
- F7: Kein übertriebenes Klischee: nur einzelne Messzahlen („70 %", „900 ms to 180 ms", „35 % to 75 %"), daneben normale Punkte wie „Mentoring three engineers"; die Sprachangabe „Igbo (conversational)" wirkt eher authentisch als klischeehaft.
- F8: Kein Laienirrtum: Aufgaben sind fachlich plausibel („event-driven reconciliation with Kafka", „query tuning and caching (Redis)", „integration tests with JUnit and Testcontainers").
- F9: Kein harter Fehler: Java 11 (Release 09/2018) passt zu „06/2019 – 12/2022", Studium „2013 – 2016" passt zum Berufseinstieg „09/2016"; allenfalls „ten years of experience" ist bei Start 09/2016 großzügig gerundet.
- F10: Behalten, mit Mini-Korrektur: in `contact` die Adresse um „10997 Berlin" ergänzen.

**Mensch**

- F1: Ja.
- F2: Erst Software Developer bei Brightwater Systems Ltd, Leeds, mit Java EE, dann Backend Engineer bei Harbourline Logistics Ltd, London, mit Spring Boot. Ist das okay? Vorher keine Backend-Entwicklung, direkt von Software Developer zu Backend – sollte es nicht erst Junior-Backend-Entwickler, dann Backend-Entwickler sein?
- F3: wie glm-5.3.
- F4: wie glm-5.3.
- F5: wie glm-5.3.
- F6: wie glm-5.3.
- F7: wie glm-5.3.
- F8: wie glm-5.3.
- F9: wie glm-5.3.
- F10: Sollen wir F2 beachten und eine Anpassung ausführen?

**Urteil:** behalten – keine Änderung; die erste Stelle war schon Backend-Arbeit, nach drei Jahren passt „Backend Engineer“ ohne „Junior“; „ten years“ stimmt (09/2016 bis heute); „10997 Berlin“ kommt nicht in `contact`.

### 03-fullstack-de

**glm-5.3 (high)**

- F1: Ja, echter Lebenslauf („Lebenslauf Jonas Weber" mit Berufserfahrung/Ausbildung/Kenntnisse/Sprachen); `isCv: true` ist korrekt.
- F2: `fullstack` passt: aktueller Titel „Fullstack-Entwickler" mit „Backend mit Node.js, Express und PostgreSQL, Frontend mit Vue 3"; keine gleichwertige zweite Rolle, reines Frontend/Backend wäre schwächer belegt.
- F3: Nein — die zwei Stationen („Rheinblick Software GmbH", „Kaufhaus Brandt KG") stimmen; die „Ausbildung zum Fachinformatiker … Domstadt IT-Service GmbH" steht zutreffend nicht in `stations`, da Ausbildung laut Regeln keine Station ist.
- F4: Ja — im PDF steht „Venloer Straße 215 · 50823 Köln", aber `contact` enthält nur „Venloer Straße 215"; zudem fehlen „in Bonn" (Geburtsort) und „Staatsangehörigkeit: deutsch".
- F5: Ja — der Fall prüft alle drei Punkte: Fullstack-Rolle im Job, Ausbildung nur im Abschnitt „Ausbildung" (Verlockung, sie als Station zu zählen), und „Geburtsdatum: 14.03.1998" bzw. „Familienstand: ledig" im Kopf, die via `contact` abgeprüft werden.
- F6: Tendenz ja — „Fullstack-Entwickler" steht wörtlich im Titel, die Zeitleiste ist lückenlos („08/2015 – 07/2018", „08/2018 – 04/2021", „05/2021 – heute") und fehlerfrei; Schwierigkeit entsteht nur durch den Ausbildungs-Distraktor und die Privates-Prüfung.
- F7: Nein — keinerlei Erfolgszahlen pro Zeile, einzige Zahl ist die IHK-„Note: gut"; „Jonas Weber" aus Köln/Bonn ist ein neutraler Name ohne Klischee-Belastung.
- F8: Nein — Details wie „Anbindung von Zahlungsdienstleistern und DATEV-Export" für Handwerksbetriebe und der IHK-Abschluss wirken fachkundig, keine Laien-Vorstellung von Rollen oder Titeln.
- F9: Nein — Daten sind konsistent (Ausbildung 2015–2018 nach „Fachabitur 2015", Geburtsdatum 1998 passt dazu), Vue 2 im Shop 2018–2021 und Vue 3 ab 2021 sind zeitlich stimmig.
- F10: Behalten mit kleiner Korrektur — `contact` um „50823 Köln" (Adresse) und idealerweise Geburtsort/Staatsangehörigkeit ergänzen; sonst ist der Fall fair, konsistent und prüft genau den deklarierten Fokus.

**Mensch**

- F1: Ja.
- F2: Im Lebenslauf steht kein Titel, die Rolle steht nur innerhalb der Berufserfahrung.
- F3: Nein.
- F4: Wohl dasselbe Problem wie in den vorigen Fällen.
- F5: Ja.
- F6: Wie bei F2 erwähnt.
- F7: Nein.
- F8: Nein.
- F9: Nein.
- F10: Nur der Titel der Rolle sollte eingetragen werden.

**Urteil:** behalten – keine Änderung; ohne Titel unter dem Namen ist der Lebenslauf realistisch und das Modell muss die Rolle aus der Berufserfahrung ablesen; „Staatsangehörigkeit: deutsch“ kommt nicht in `contact` (würde mit der Sprache „Deutsch“ fälschlich anschlagen), Geburtsort und „50823 Köln“ auch nicht.
