# Stellen-Import (ETL)

Dieses Dokument hält fest, wie die Stellen der Bundesagentur für Arbeit (BA) in die Tabelle `jobs`
kommen, welche Probleme dabei aufgetreten sind und wie sie gelöst wurden. Wer Stellen neu
importiert oder den Import ändert, liest zuerst hier – damit nichts doppelt herausgefunden werden
muss. Stufe im Plan: [STUFEN.md](STUFEN.md), Stufe 1b.

Code: `backend/src/jobs/` (`jobs.service.ts` = Holen, Umwandeln, Speichern; `jobs.tables.ts` =
Tabelle; `import-jobs.ts` = Aufruf). Tests: `backend/test/jobs.test.ts` mit 20 echten
Beispielstellen in `backend/test/fixtures/`.

---

## 1. Kurzanleitung

```bash
pnpm db:migrate
pnpm jobs:import 3000
pnpm jobs:import 50 "Backend Entwickler" Berlin
```

- `pnpm jobs:import <anzahl>` ohne Suchbegriff: alle Bereiche, gleich viele Stellen je Bundesland.
- Mit Suchbegriff und Ort: nur diese Suche.
- Ein Lauf mit 3.000 Stellen dauert etwa 10 Minuten (ein Detail-Abruf pro Stelle) und speichert
  rund 2.600–2.700 Stellen: Etwa 6 % sind älter als 30 Tage, etwa 3 % sind Dubletten.
- Ein erneuter Lauf überspringt bekannte Stellen, ohne ihre Details neu zu laden. Bricht ein Lauf
  ab, einfach neu starten.
- Dev-Daten neu aufbauen: `docker exec jobmatch-db psql -U jobmatch -d jobmatch -c "truncate jobs"`,
  dann neu importieren. Die Daten sind jederzeit von der API wiederholbar.

Ausgabe am Ende, Beispiel:

```
Gefunden: 2958, schon vorhanden: 0, neu gespeichert: 2672, älter als 30 Tage: 188,
ungültig: 4, doppelter Text: 94
```

---

## 2. Die API der Bundesagentur

Inoffiziell: Die BA bietet keine offizielle API an. Die Doku stammt von der Community
([bund.dev](https://jobsuche.api.bund.dev/), [GitHub bundesAPI/jobsuche-api](https://github.com/bundesAPI/jobsuche-api)).
Endpunkte können sich ändern – der Import ist deshalb klein und austauschbar gehalten.

| Was         | Wert                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| Basis-URL   | `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service`                    |
| Schlüssel   | Header `X-API-Key: jobboerse-jobsuche` (fest, für alle gleich, kostenlos)      |
| Suche       | `GET /pc/v6/jobs?was=&wo=&page=&size=&veroeffentlichtseit=`                    |
| Details     | `GET /pc/v4/jobdetails/{base64(referenznummer)}` – nur hier steht der Volltext |
| Alt, kaputt | `/pc/v4/jobs` antwortet mit 403                                                |

**Grenzen und Eigenheiten der Suche** (alle selbst gemessen, Oktober 2026):

- Pro Suche sind nur die ersten **10.000 Treffer** erreichbar (`page × size ≤ 10.000`, darüber 400).
- Sortiert wird nur nach **Aktualität** (neueste zuerst). Es gibt keinen Sortier-Parameter und
  keinen Datumsbereich („von–bis“), nur `veroeffentlichtseit` (0–100 Tage).
- **`veroeffentlichtseit=30` ist unzuverlässig:** Es kamen Stellen mit Erstveröffentlichung
  April 2026 und sogar 2024 durch. Der Code prüft das Alter deshalb selbst.
- **Bundesländer brauchen den Zusatz „(Bundesland)“:** `wo=Hessen` sucht im Umkreis des Dorfs
  _Hessen bei Halberstadt_, `Sachsen` bei _Sachsen bei Ansbach_, `Brandenburg` in _Brandenburg an
  der Havel_, Berlin/Hamburg/Bremen als Stadt-Umkreis. `wo=Hessen (Bundesland)` liefert
  `suchmodus: BUNDESLANDSUCHE` für alle 16 Länder. Prüfen lässt sich das am Feld
  `woOutput.suchmodus` der Antwort.
- Leeres Ergebnis: Das Feld `ergebnisliste` fehlt ganz (`maxErgebnisse: 0`).
- Ohne `was` kommen alle Bereiche (rund 1 Million Stellen in 30 Tagen).
- Weitere Filter laut Doku: `angebotsart` (1 Arbeit, 2 Selbstständigkeit, 4 Ausbildung,
  34 Praktikum), `arbeitszeit` (`vz;tz;ho;mj;snw`), `befristung`, `zeitarbeit`, `umkreis`,
  `berufsfeld`. Bisher nicht genutzt.

**Details:** Eine Stelle kann zwischen Suche und Detail-Abruf verschwinden (404). Das zählt als
„ungültig“, der Lauf geht weiter. Netzwerkfehler (z. B. `ENETUNREACH`) kommen vor; jeder Abruf wird
bis zu zweimal wiederholt.

---

## 3. Extract – Holen

1. **Suchen:** Ohne Ort wird jedes der 16 Bundesländer mit gleichem Anteil abgefragt
   (`limit / 16`). Innerhalb eines Landes werden die Seiten (je 25 Stellen) gleichmäßig über die
   erreichbaren Treffer verteilt, z. B. Seiten 1, 101, 201, 301 statt 1–4. So streuen die Stellen
   über mehrere Tage statt nur „heute“.
2. **Bekannte überspringen:** Referenznummern, die schon in der DB stehen, werden nicht neu geladen.
3. **Details laden:** ein Aufruf pro neuer Stelle, nacheinander (schont die API).

---

## 4. Transform – Umwandeln (`toJob`)

Die Antwort wird mit Zod geprüft und in **eigene** Spalten übersetzt. Grundsatz: Eine fehlende
Angabe wird `null` (unbekannt), nie `false`.

| Spalte                                                   | Quelle in der BA-Antwort                                                  | Regel                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `external_id`                                            | `referenznummer`                                                          | eindeutig mit `source = 'ba'`                                                                                                     |
| `offer_type`                                             | `stellenangebotsart`                                                      | `ARBEIT`→`job`, `AUSBILDUNG`→`apprenticeship`, `PRAKTIKUM_TRAINEE`→`internship`, `SELBSTAENDIGKEIT`→`self_employed`, sonst `null` |
| `title`                                                  | `stellenangebotsTitel`                                                    | fehlt er, dient `hauptberuf` als Titel                                                                                            |
| `company`                                                | `firma`                                                                   | Pflicht                                                                                                                           |
| `occupation`                                             | `hauptberuf`                                                              | fehlt bei Ausbildung oft → `null`                                                                                                 |
| `description`                                            | `stellenangebotsBeschreibung`                                             | Pflicht, nicht leer; enthält oft Markdown                                                                                         |
| `city`, `region`, `postal_code`, `latitude`, `longitude` | `stellenlokationen[0]`                                                    | nur der **erste** Ort; alle Felder optional                                                                                       |
| `full_time`                                              | `arbeitszeitVollzeit`                                                     | fehlt manchmal → `null`                                                                                                           |
| `part_time`                                              | `arbeitszeitTeilzeit{Vormittag,Nachmittag,Abend,Flexibel}`                | `true`, wenn eins `true`; `null`, wenn alle fehlen                                                                                |
| `remote`                                                 | `homeofficemoeglich`                                                      | fehlt bei über der Hälfte → `null`                                                                                                |
| `permanent`                                              | `vertragsdauer`                                                           | `UNBEFRISTET`→`true`, `BEFRISTET`→`false`, `KEINE_ANGABE`→`null`                                                                  |
| `salary_min_year`, `salary_max_year`                     | `gehaltsspanneVon/Bis` oder `festgehalt`, Einheit aus `verguetungsangabe` | in € pro Jahr: Jahr ×1, Monat ×12, Stunde ×2080; siehe Regeln unten                                                               |
| `agency`                                                 | `istPrivateArbeitsvermittlung`, `istArbeitnehmerUeberlassung`             | `true`, wenn eins `true`                                                                                                          |
| `url`                                                    | `externeURL`                                                              | sonst `https://www.arbeitsagentur.de/jobsuche/jobdetail/<referenznummer>`; ungültige URL wird ignoriert                           |
| `published_at`                                           | `datumErsteVeroeffentlichung`                                             | Pflicht                                                                                                                           |
| `raw`                                                    | ganze Detail-Antwort                                                      | bleibt gespeichert, für spätere Felder                                                                                            |

**Ungültig** (nicht gespeichert) ist eine Stelle nur, wenn Titel **und** Beruf fehlen, Firma oder
Volltext fehlen, kein Ort-Eintrag existiert oder das Datum fehlt. Das betrifft etwa 0,1 %.

---

## 5. Load – Speichern und Bereinigen

| Regel                                                    | Wo                                                                               | Warum                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Erstveröffentlichung älter als 30 Tage → nicht speichern | `importJobs`                                                                     | Filter der API lässt ältere durch                                     |
| Gleiche Quelle + Referenznummer nur einmal               | Unique `jobs_source_external_id_unique`                                          | erneuter Import                                                       |
| Gleiche Firma + gleicher Text nur einmal                 | Unique-Index `jobs_company_description_unique` auf `(company, md5(description))` | Dubletten (gleiche Anzeige in mehreren Filialen) und Platzhaltertexte |
| Gehalt bei reiner Teilzeit → `null`                      | `toJob`                                                                          | unklar, ob Teilzeit- oder Vollzeitwert                                |
| Gehalt unter 15.000 oder über 250.000 €/Jahr → `null`    | `toJob`                                                                          | Minijobs, falsche Einheit                                             |

Eingefügt wird mit `onConflictDoNothing().returning()`: Kommt keine Zeile zurück, war es eine
Dublette.

---

## 6. Probleme und Lösungen (Verlauf)

| #   | Problem                                                                                                  | Entdeckt durch                                | Lösung                                                |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| 1   | `/pc/v4/jobs` antwortet 403                                                                              | erster Test                                   | `/pc/v6/jobs` für die Suche                           |
| 2   | Suche liefert keinen Volltext                                                                            | Feldvergleich Suche/Details                   | zweiter Aufruf `/pc/v4/jobdetails/{base64}`           |
| 3   | Viele Felder fehlen je Stelle (Homeoffice 9/20, Gehalt 6/20)                                             | 20 Stellen ausgezählt                         | optional im Schema, `null` statt `false`              |
| 4   | Gehalt in gemischten Einheiten (34,07 €/Std. neben 40.000 €/Jahr)                                        | Feldvergleich                                 | alles in € pro Jahr umrechnen                         |
| 5   | `arbeitszeitVollzeit` fehlt bei manchen Stellen                                                          | erster echter Lauf                            | optional                                              |
| 6   | Stelle mit 10 Orten, die hinteren ohne Stadt                                                             | erster echter Lauf                            | nur den ersten Ort streng prüfen (`z.tuple` mit Rest) |
| 7   | `veroeffentlichtseit=30` lässt Anzeigen von 2024 durch                                                   | Daten in der DB                               | Alter im Code prüfen                                  |
| 8   | 118 von 2.500 „ungültig“: nur Bundesland statt Stadt (Außendienst, Hays), kein `hauptberuf` (Ausbildung) | Gründe ausgezählt                             | Stadt und Beruf optional                              |
| 9   | Stellen ohne Titel                                                                                       | Gründe ausgezählt                             | Beruf als Ersatztitel                                 |
| 10  | Ohne Suchbegriff fast nur Stellen von heute                                                              | Stichprobe von 10 Stellen                     | pro Bundesland suchen, Seiten verteilen               |
| 11  | Hessen 4, Sachsen 12, Brandenburg 36 Stellen; zu viel Sachsen-Anhalt                                     | Verteilung nach `region`                      | `wo="<Land> (Bundesland)"`                            |
| 12  | Fremder Platzhaltertext („rexx systems …“) unter 21 verschiedenen Titeln                                 | Stichprobe, dann `md5(description)` gruppiert | Unique-Index Firma + Text                             |
| 13  | Teilzeitstelle mit Vollzeit-Gehalt                                                                       | Stichprobe                                    | Gehalt bei reiner Teilzeit `null`                     |
| 14  | Stellenart nur in `raw`                                                                                  | Auswertung                                    | Spalte `offer_type`, Backfill-Migration aus `raw`     |

**Lehre daraus:** 20 Beispielstellen haben die meisten Fälle nicht gezeigt. Erst Läufe mit
mehreren tausend Stellen und Auszählungen per SQL (fehlende Felder, Verteilung, gleiche Texte)
haben sie sichtbar gemacht.

---

## 7. Bekannte Grenzen (offen)

- **Text passt inhaltlich nicht zum Titel:** Eine Regel kann das nicht prüfen (eine Wortsuche hat
  fast nur korrekte Anzeigen markiert). Das ist eine Aufgabe für Claude: Prompt-Unit
  `job_extraction` in Stufe 3, mit Structured Outputs. Die importierten Stellen sind dafür zugleich
  der Gold Standard der Evaluation ([EVAL.md](EVAL.md) 6.3).
- **Zeitliche Streuung:** Trotz verteilter Seiten stammen rund 70 % der Stellen aus der letzten
  Woche, weil pro Land nur die neuesten 10.000 erreichbar sind.
- **Saarland** hat weniger Stellen (~64 statt ~180): Dort gibt es insgesamt wenig, und mehr davon
  sind älter als 30 Tage.
- **Kontaktdaten im Volltext** (Namen, Telefon, E-Mail): bleiben in der DB, gehen nie ins Log.
- **Abgelaufene Stellen** werden nicht gelöscht; dafür gibt es noch keinen Lauf (Stufe 7).

---

## 8. Prüfen nach einem Import

```bash
docker exec jobmatch-db psql -U jobmatch -d jobmatch -c "select count(*), count(distinct occupation), count(salary_min_year), count(remote), min(published_at), max(published_at) from jobs"
docker exec jobmatch-db psql -U jobmatch -d jobmatch -c "select region, count(*) from jobs group by 1 order by 2 desc"
docker exec jobmatch-db psql -U jobmatch -d jobmatch -c "select offer_type, count(*) from jobs group by 1"
docker exec jobmatch-db psql -U jobmatch -d jobmatch -c "select md5(description), count(distinct title) from jobs group by 1 having count(distinct title) > 3"
```

Erwartet: alle 16 Länder mit ähnlicher Zahl, Daten über mehrere Wochen, keine Texte unter vielen
verschiedenen Titeln.

---

## 9. Den Import erweitern

- **Neues Feld nutzen:** Es steht schon in `raw`. Spalte in `jobs.tables.ts` ergänzen und in
  `toJob` befüllen, `pnpm db:generate`, dann für vorhandene Zeilen eine eigene Migration
  (`npx drizzle-kit generate --custom --name <name>` im Ordner `backend`) mit einem `UPDATE … raw->>'…'`.
  Beispiel: Migration `0006_backfill_job_offer_type.sql`.
- **Neue Regel:** zuerst mit SQL auszählen, wie oft der Fall vorkommt, dann Regel in `toJob` oder
  als Index, dann ein Test in `jobs.test.ts`.
- **Neue Quelle:** eigene `source`, eigene Umwandlung auf dieselben Spalten; die Tabelle ist
  nicht an die BA gebunden.
- **Tests:** rufen nie die echte API auf; `fetch` wird durch die Beispielantworten aus
  `backend/test/fixtures/` ersetzt, das Datum mit `vi.useFakeTimers({ toFake: ['Date'] })`
  festgehalten.
