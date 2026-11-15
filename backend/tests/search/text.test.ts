import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { UNSAFE_TEXT } from '../../src/llm/untrusted.js'
import { JOB_TEXT_MAX_CHARS } from '../../src/modules/jobs/jobs.schemas.js'
import * as searchConfig from '../../src/modules/search/search.config.js'
import { cvText, jobText } from '../../src/modules/search/search.text.js'
import * as jobPrompt from '../../src/prompts/job_extract/job_extract.texts.js'
import { SEARCH_ANALYSIS } from '../helpers.js'

const DETAILS = JSON.parse(readFileSync(new URL('../jobs/fixtures/details.json', import.meta.url), 'utf8')) as {
  stellenangebotsBeschreibung: string
}

function text(description: string, title = 'Frontend-Entwicklerin (m/w/d)'): string {
  return jobText({ title, description }).text
}

test('the description of the Bundesagentur loses its markdown and keeps its words', () => {
  const result = text(DETAILS.stellenangebotsBeschreibung)
  expect(result).not.toContain('###')
  expect(result).not.toContain('**')
  for (const word of ['Vue 3', 'TypeScript', 'Tailwind']) expect(result).toContain(word)
})

test('the gender note leaves the title, in every listed form', () => {
  expect(text('', 'Frontend-Entwicklerin (m/w/d)')).toBe('Frontend-Entwicklerin')
  for (const note of ['(w/m/d)', '(M/F/D)', '(m|w|d|x)', '(all genders)', '(gn)']) {
    expect(text('', `Entwickler ${note}`)).toBe('Entwickler')
  }
})

test('the gender note with bars leaves the title too', () => {
  const result = text('', 'Backend-Entwickler (m|w|d)')
  expect(result).toBe('Backend-Entwickler')
  expect(result).not.toMatch(/\(m|w d\)/u)
})

test('the gap mark of the search is the one job_extract writes', () => {
  expect(jobPrompt.RULES).toContain(searchConfig.UNREADABLE)
  expect(jobPrompt.REFOCUS).toContain(searchConfig.UNREADABLE)
})

test('an address split into two bold parts is still replaced', () => {
  const result = text('an [**bewerbung@**](https://mailto:bewerbung@erminas.de)**oixio.eu** und starte', 'T')
  expect(result).toBe('T\n\nan [E-Mail] und starte')
  expect(result).not.toContain('@')
})

test('entities become their characters after the HTML is removed', () => {
  expect(text('Ticket &amp; Bike&nbsp;Leasing, &quot;Team&quot; &#39;Go&#x27;', 'T')).toBe(
    'T\n\nTicket & Bike Leasing, "Team" \'Go\'',
  )
  expect(text('Konzeption &ndash; Betrieb &mdash; Pflege', 'T')).toBe('T\n\nKonzeption – Betrieb — Pflege')
  expect(text('&lt;b&gt;fett&lt;/b&gt; und <b>echt</b>', 'T')).toBe('T\n\n<b>fett</b> und echt')
  expect(text('a&#8203;b &#917505;c &unbekannt;', 'T')).toBe('T\n\nab c &unbekannt;')
  expect(text('Kenntnisse: &constructor; &toString; &hasOwnProperty;', 'T')).toBe(
    'T\n\nKenntnisse: &constructor; &toString; &hasOwnProperty;',
  )
})

test('markdown escapes lose their backslash', () => {
  expect(text('Referenzcode: 2026\\_E\\_003373, 1\\. Stelle, C\\#', 'T')).toBe('T\n\nReferenzcode: 2026_E_003373, 1. Stelle, C#')
})

test('a single star at a word edge goes, inside a word or between spaces it stays', () => {
  expect(text('Go *(Must-have)* und *wichtig*', 'T')).toBe('T\n\nGo (Must-have) und wichtig')
  expect(text('Entwickler*innen und 2 * 3', 'T')).toBe('T\n\nEntwickler*innen und 2 * 3')
  expect(text('snake_case und `code`', 'T')).toBe('T\n\nsnake_case und `code`')
})

test('a line [nicht lesbar] goes, the text around it stays', () => {
  expect(text('Wir bauen Apps.\n[nicht lesbar]\nMit Vue.')).toBe('Frontend-Entwicklerin\n\nWir bauen Apps.\n\nMit Vue.')
})

test('zero width and tag block characters leave the text', () => {
  const result = text('Vue​ 3 \u{E0041}\u{E0042}Kubernetes')
  expect(result).not.toMatch(/[\u200B\u{E0000}-\u{E007F}]/u)
  expect(result).toContain('Vue 3 Kubernetes')
})

test('a link keeps its text, images and free addresses go', () => {
  const result = text('[Jetzt bewerben](https://example.org/job) ![Logo](https://example.org/l.png) siehe https://example.org/x')
  expect(result).toContain('Jetzt bewerben')
  expect(result).not.toMatch(/https?:|example\.org|Logo/u)
})

test('HTML tags go, block tags end a line and words split by tags join again', () => {
  expect(text('<p>Wir suchen</p><p>Vue 3</p>')).toBe('Frontend-Entwicklerin\n\nWir suchen\n\nVue 3')
  expect(text('Kuber<b>netes</b>')).toContain('Kubernetes')
})

test('hidden elements and comments go with their content, the text around them stays', () => {
  for (const hidden of [
    '<div style="display: none">Senior Architekt</div>',
    '<span hidden>Senior Architekt</span>',
    '<p aria-hidden="true">Senior Architekt</p>',
    '<span class="sr-only">Senior Architekt</span>',
    '<script>Senior Architekt</script>',
    '<!-- Senior Architekt -->',
  ]) {
    const result = jobText({ title: 'Titel', description: `davor ${hidden} danach` })
    expect(result.text).toBe('Titel\n\ndavor danach')
    expect(result.hiddenElements).toBe(1)
  }
})

test('a nested hidden element goes up to its own closing tag, an open one to the end', () => {
  expect(text('<div hidden><div>a</div>b</div>c', 'T')).toBe('T\n\nc')
  expect(text('x<div hidden>a', 'T')).toBe('T\n\nx')
  expect(jobText({ title: 'T', description: '<div hidden><span hidden>a</span></div>' }).hiddenElements).toBe(1)
})

test('a closing tag inside a comment does not end a hidden element', () => {
  const result = jobText({ title: 'T', description: 'x<div hidden><!-- </div> -->Senior Architekt</div>y' })
  expect(result.text).toBe('T\n\nxy')
  expect(result.hiddenElements).toBe(2)
})

test('hidden markers without quotes are found too', () => {
  for (const hidden of [
    '<span style=display:none>Senior Architekt</span>',
    '<span class=hidden>Senior Architekt</span>',
    '<span class=sr-only>Senior Architekt</span>',
    '<p aria-hidden=true>Senior Architekt</p>',
  ]) {
    const result = jobText({ title: 'T', description: `x${hidden}y` })
    expect(result.text).toBe('T\n\nxy')
    expect(result.hiddenElements).toBe(1)
  }
})

test('visible styles and look-alike classes stay', () => {
  expect(text('<div style="opacity:0.5">sichtbar</div><div class="not-hidden">auch</div>', 'T')).toBe('T\n\nsichtbar\n\nauch')
})

test('a less-than sign before a number or a space is no tag', () => {
  expect(text('< 5 Jahre und <3', 'T')).toBe('T\n\n< 5 Jahre und <3')
})

test('email addresses become [E-Mail], also with a subdomain and inside a link', () => {
  const result = text('bewerbung@firma.de und Max.Muster@mail.firma-gruppe.de', 'T')
  expect(result).toBe('T\n\n[E-Mail] und [E-Mail]')
  expect(text('<a href="mailto:jobs@firma.de">jobs@firma.de</a>', 'T')).toBe('T\n\n[E-Mail]')
})

test('an email autolink in angle brackets goes completely', () => {
  const result = text('Bewerbung an <bewerbung@firma.de> bis Freitag', 'T')
  expect(result).toBe('T\n\nBewerbung an bis Freitag')
  expect(result).not.toMatch(/@|firma\.de|<|\[E-Mail\]/u)
})

test('C#, Node.js and @vue/cli stay', () => {
  expect(text('C#, Node.js und @vue/cli', 'T')).toBe('T\n\nC#, Node.js und @vue/cli')
})

test('only the first JOB_TEXT_MAX_CHARS characters of the description are read', () => {
  const result = text(`${'a'.repeat(JOB_TEXT_MAX_CHARS)}ZUVIEL`, 'T')
  expect(result).toBe(`T\n\n${'a'.repeat(JOB_TEXT_MAX_CHARS)}`)
})

test('a title of 300 characters and a description of the full length stay whole', () => {
  const title = 't'.repeat(300)
  const description = Array.from({ length: 2000 }, () => 'wort12345').join(' ').slice(0, JOB_TEXT_MAX_CHARS)
  expect(text(description, title)).toBe(`${title}\n\n${description}`)
})

test('the text of the job has neither company nor city', () => {
  const result = jobText({ title: 'Backend', description: 'Node.js' }).text
  expect(result).toBe('Backend\n\nNode.js')
})

test('the CV text has labelled lines in fixed order without employer, dates, judgements or highest degree', () => {
  expect(cvText(SEARCH_ANALYSIS)).toBe(
    'Stationen: Backend-Entwicklerin\nKenntnisse: TypeScript, Node.js, PostgreSQL\nAbschlüsse: B.Sc. Informatik\nSprachen: Deutsch (C2)',
  )
  const result = cvText({
    ...SEARCH_ANALYSIS,
    positions: [{ employer: 'Einzigartig-AG', title: 'Dev', start: '2019', ongoing: false, end: '2020' }],
    education: [{ degree: 'M.Sc.', institution: 'Uni-Einzig', year: '2018' }],
    strengths: ['Stärke-Einzig'],
    weaknesses: ['Schwäche-Einzig'],
    tips: ['Tipp-Einzig'],
  })
  for (const value of ['Einzigartig-AG', 'Uni-Einzig', 'Stärke-Einzig', 'Schwäche-Einzig', 'Tipp-Einzig', '2019', '2018']) {
    expect(result).not.toContain(value)
  }
  expect(result).not.toContain('Höchster Abschluss')
  expect(result.match(/B\.Sc\. Informatik/gu) ?? []).toHaveLength(0)
})

test('the CV text skips empty titles, joins duplicates and writes a language without level alone', () => {
  const result = cvText({
    ...SEARCH_ANALYSIS,
    positions: [
      { employer: null, title: null, start: null, ongoing: false, end: null },
      { employer: null, title: 'Dev', start: null, ongoing: false, end: null },
      { employer: null, title: 'Dev', start: null, ongoing: false, end: null },
    ],
    languages: [{ name: 'Englisch', level: null }],
  })
  expect(result).toContain('Stationen: Dev\n')
  expect(result).toContain('Sprachen: Englisch')
  expect(result).not.toContain('Englisch (')
})

test('the degree shared by highest_degree and education is in the text once', () => {
  expect(cvText(SEARCH_ANALYSIS).match(/B\.Sc\. Informatik/gu)).toHaveLength(1)
})

test('a CV without embedded values gives an empty text', () => {
  expect(cvText({ ...SEARCH_ANALYSIS, positions: [], skills: [], education: [], languages: [] })).toBe('')
})

test('the new constants leave UNSAFE_TEXT as it was', () => {
  expect(UNSAFE_TEXT.source).toBe(
    String.raw`https?:\/\/|\bwww\.|[\w.+-]+@[\w-]+\.[a-z]{2,}|\b(?:[a-z0-9-]+\.)+(?!js\/|net\/)[a-z]{2,}\/|!?\[[^\]]*\]\(|<\/?[a-z]`,
  )
})
