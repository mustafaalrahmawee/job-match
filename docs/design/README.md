job-match begleitet Bewerbende von der Stellenanzeige bis zur Zusage. Die Oberfläche ist ruhig und neutral: fast alles ist Grau auf Weiß, Indigo (`brand`) kommt nur dort vor, wo die App selbst spricht oder etwas aktiv ist. Alles, was hier steht, ist aus dem Vue-Frontend abgelesen (`frontend/src/assets/main.css` und die Komponenten); wer eine Seite baut, baut sie mit diesen Werten.

## Sprache und Ton

- Deutsch, Du-Form, kurze Sätze: „Lade deinen Lebenslauf als PDF hoch.“ Keine Ausrufezeichen, keine Emojis.
- Button-Texte sind Verben im Infinitiv: „Anmelden“, „Bestätigen“, „Löschen“, „Erneut versuchen“. Während einer Aktion mit Auslassungspunkten: „Anmelden …“.
- Fehler sagen, was passiert ist, und wenn möglich, was zu tun ist: „E-Mail oder Passwort ist falsch.“ „Die Datei ist größer als 5 MB.“ Nie technische Details.
- Bestätigungsfragen im Dialog enden mit Fragezeichen: „Gespräch löschen?“ Der Text darunter sagt, was verloren geht und was bleibt.
- Zustände heißen in der App: Nicht analysiert, Wird analysiert, Analysiert, Analyse fehlgeschlagen; Bewerbungsstatus: Gespeichert, Beworben, Interview, Zusage, Absage, Zurückgezogen.
- Begriffe: „Lebenslauf“ (nicht CV), „Stellen“, „Match“, „Bewerbungen“, „Coach“, „Training“, „Gespräche“ (Chat-Verläufe).

## Farbe

- Seite auf `background`, Text in `foreground`, Nebentext in `muted-foreground`. Beide Textfarben lesen in beiden Themes auf `background`, `card` und `sidebar` mit über 4,5:1.
- Karten sind `card` mit 1 px `border` und `shadow-sm`; keine farbigen Ränder, keine Verläufe.
- Genau ein Hauptbutton pro Ansicht in `primary`. Alles andere ist Outline (`background` + `border`) oder Geist (nur Text in `muted-foreground`, Hover `accent`).
- `brand` nur für: Logo-Kachel, Coach-Avatar, Icon-Kreis im leeren Zustand (Fläche `brand` 10 %, Icon `brand`), Pille „Aktiv“, Spinner. Nie als Button-Fläche, nie als Fließtext.
- `destructive` für Löschen und Fehler. Fehlerbox: Rahmen `destructive` 30 %, Fläche `destructive` 5 %, Text `foreground` oder `destructive`.
- `success` und `warning` tragen immer ein Wort oder eine Zahl mit sich (Pille „Bestätigt“, Status, Score). `warning` nie als Text auf `background`.
- Match-Score: Zahl in `foreground`, Balken ab 70 in `success`, 40 bis 69 in `warning`, darunter in `destructive`. Die Zahl steht immer dabei.

## Schrift

- Eine Familie, Inter (`sans`), drei Gewichte: 400, 500, 600. Kein Fett über 600.
- Fließtext ist `body` (14/20). Alles in Karten, Listen, Chat und Formularen ist 14 px.
- Hierarchie durch Gewicht, nicht durch Größe: Kartentitel `section-title` (14/600), Nebenzeilen `caption` (12 px). Nur leere Zustände (`heading`), Login (`title`) und Dialoge (`dialog-title`) sind größer.
- Markdown im Chat: Zeilenhöhe 1,7, Überschriften 600, Links in `brand` unterstrichen, Code auf `muted` mit `radius-sm`.

## Raster und Abstände

- Layout: Seitenleiste `sidebar` (256 px) links, Inhalt rechts mit Kopfzeile `header` (56 px). Unter 768 px schwebt die Seitenleiste über dem Inhalt (Schatten `shadow-xl`, dunkler Schleier) und wird mit dem Knopf in der Kopfzeile geöffnet.
- Inhalt zentriert: Chat höchstens `content-chat` (768 px), Seiten mit Karten höchstens `content-wide` (1152 px). Seitenrand `space-4`, oben und unten `space-6`.
- Karten-Innenabstand `space-4`, Lücke zwischen Karten `space-4`. Zweispaltige Seiten (Lebenslauf): Hauptspalte flexibel, rechte Spalte 320 px, bleibt beim Scrollen stehen.
- Alle Steuerelemente sind `control` (36 px) hoch; kleine Buttons in Kopfzeile und Fehlerboxen `control-sm` (32 px).

## Form

- Ecken: Buttons und Felder `radius-md`, Karten und Dialoge `radius-xl`, Chat-Eingabe und Sprechblasen `radius-2xl`, Pillen und Avatare `radius-full`.
- Fokus: Rahmen `ring`, dazu ein 3 px Ring `ring` mit 50 % Deckkraft. Kein Outline.
- Deaktiviert: 50 % Deckkraft, Senden-Knopf ohne Text 30 %.
- Zustände werden als Pille gezeigt (`caption-medium`, `radius-full`, Fläche 10 % der Farbe): „Aktiv“ in `brand`, „Bestätigt“ in `success`.

## Icons

- Lucide (`@lucide/vue`), Strichstärke 2, `icon` (16 px) in Buttons und Navigation, 14 px in kleinen Buttons, 20 px im leeren Zustand. Icons sind nie allein: Icon-Buttons tragen `aria-label` und `title`.
- Feste Zuordnung: Start House, Coach MessageSquare, Lebenslauf FileText, Stellen Briefcase, Bewerbungen ClipboardList, Training GraduationCap, Dokumente FolderOpen; Coach-Antwort Sparkles; Neues Gespräch SquarePen; Hochladen Upload; Löschen Trash2; Umbenennen Pencil; Abmelden LogOut; Erneut RotateCcw; Senden ArrowUp; Stopp Square.
- Logo: Kachel `brand` mit `radius-md` und BriefcaseBusiness in `brand-foreground`, daneben die Wortmarke „job-match“ in `logo`. Es gibt keine eigene Bildmarke.

## Bausteine

Jede Seite ist Kopfzeile plus Inhalt in der Hauptspalte neben der Seitenleiste. Formulare sind Label über Feld, `space-2` dazwischen, Felder volle Breite. Listen (Versionen, Stellen, Bewerbungen) sind Zeilen in einer Karte mit `space-2` Innenabstand, Hover `accent`, Aktionen rechts erscheinen beim Überfahren. Leere Zustände stehen zentriert mit `space-16` Abstand oben: Icon-Kreis, `heading`, ein Satz `body` in `muted-foreground`, ein Hauptbutton. Lange Vorgänge zeigen eine Karte mit Spinner in `brand` und dem Satz „Wird analysiert … Das kann ein paar Minuten dauern.“

Vorgesehene Ergänzungen für die Stufen 3 bis 8, noch nicht im Code: `MatchScore` (Score mit Balken) und die Status-Pillen für Bewerbungen. Beide folgen den Regeln oben.

## Screens

Ein Screen je Use Case in `screens/`, Desktop mit 1440 px, als HTML mit den Werten aus `tokens.json`. Der Dateiname nennt den Use Case (`UC-09-Match-Analyse.dc.html`); `Start.dc.html` ist die Übersichtsseite nach dem Anmelden. Eine neue Seite im Frontend folgt ihrem Screen: Aufbau, Bausteine, Texte, Zustände. Was dort fehlt, wird nach den Regeln oben ergänzt, nicht neu erfunden.

Bearbeitet werden Design System und Screens in Claude Design; danach werden die Dateien hier neu exportiert:

- Design System: https://claude.ai/artifact/1ByWCz7GXqiBKzRcwTUR6P
- Screens: https://claude.ai/artifact/HsRYwcVEUTpZu6MdDBcJic
