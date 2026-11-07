import type { CoachCv } from './cv_analysis.schemas.js'

const CHECK_DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
})

export function checkDate(analyzedAt: Date): string {
  return `Die Beraterin füllt den Bogen am ${CHECK_DATE_FORMAT.format(analyzedAt)} aus; nach diesem Tag richtet sich, ob eine Station noch läuft und wie lange eine Angabe im Lebenslauf zurückliegt.`
}

export function cvAside({ role, analysis, asOf }: CoachCv, only?: readonly string[]): string {
  const sections: [string, string[]][] = [
    ['Zielrolle', [role]],
    [
      'Stationen',
      analysis.positions.map(
        (p) =>
          `${[p.title, p.employer].filter(Boolean).join(', ') || 'unbekannt'}, ${p.start ?? 'unbekannt'} bis ${p.ongoing ? 'heute' : (p.end ?? 'unbekannt')}`,
      ),
    ],
    ['Kenntnisse', analysis.skills],
    ['Ausbildung', analysis.education.map((e) => [e.degree, e.institution, e.year].filter(Boolean).join(', '))],
    ['Höchster Abschluss', analysis.highest_degree ? [analysis.highest_degree] : []],
    ['Sprachen', analysis.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name))],
    ['Stärken', analysis.strengths],
    ['Schwächen', analysis.weaknesses],
    ['Tipps', analysis.tips],
  ]
  const body = sections
    .filter(([title]) => !only || only.includes(title))
    .map(([title, items]) => `${title}:\n${items.map((item) => `- ${item}`).join('\n') || '- keine Angabe'}`)
    .join('\n\n')
  return `<lebenslauf quelle="Analyse der aktiven Lebenslauf-Version in job-match" stand="${asOf}">\n${body}\n</lebenslauf>`
}
