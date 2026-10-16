import { franc } from 'franc'
import { CV_LIST_LIMITS, cvAnalysisSchema } from '../src/prompts/cv_analysis.js'

export type RunRecord = {
  text: string
  stop_reason: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number
  error: string | null
}

export type CoachChatGold = {
  language: string
  declines_scope: boolean
  forbidden: string[]
  max_words: number
}

export type Check = { name: string; ok: boolean; detail: string }

const LENGTH_TOLERANCE = 1.1

const ISO_639_1: Record<string, string> = {
  arb: 'ar',
  deu: 'de',
  eng: 'en',
  fra: 'fr',
  ita: 'it',
  nld: 'nl',
  pes: 'fa',
  pol: 'pl',
  ron: 'ro',
  rus: 'ru',
  spa: 'es',
  tur: 'tr',
  ukr: 'uk',
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

export function detectLanguage(text: string): string {
  const prose = text.replace(/\[[^\]]*\]/g, ' ').replace(/[*_#>`|-]/g, ' ')
  const code = franc(prose, { only: Object.keys(ISO_639_1) })
  return ISO_639_1[code] ?? code
}

export function coachChatChecks(gold: CoachChatGold, run: RunRecord): Check[] {
  const words = countWords(run.text)
  const language = detectLanguage(run.text)
  const lower = run.text.toLowerCase()
  const hits = gold.forbidden.filter((phrase) => lower.includes(phrase.toLowerCase()))
  return [
    { name: 'end_turn', ok: run.stop_reason === 'end_turn', detail: run.error ?? run.stop_reason ?? 'none' },
    { name: 'not_empty', ok: run.text.trim().length > 0, detail: '' },
    { name: 'language', ok: language === gold.language, detail: `${language}, expected ${gold.language}` },
    { name: 'max_words', ok: words <= Math.floor(gold.max_words * LENGTH_TOLERANCE), detail: `${words}/${gold.max_words}` },
    { name: 'forbidden', ok: hits.length === 0, detail: hits.join('; ') },
  ]
}

export type CvAnalysisGold = {
  is_cv: boolean
  role: string
  accepted_roles: string[]
  positions: { employer: string; title: string; years: string }[]
  must_skills: { name: string; synonyms: string[] }[]
  absent_skills: string[]
  languages: string[]
  highest_degree: string | null
  forbidden: string[]
}

export type Tally = { ok: number; total: number }

export function mentions(text: string, term: string): boolean {
  const haystack = text.toLowerCase()
  const needle = term.toLowerCase()
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    const before = haystack[at - 1] ?? ' '
    const after = haystack[at + needle.length] ?? ' '
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true
  }
  return false
}

export function cvAnalysisChecks(gold: CvAnalysisGold, run: RunRecord): Check[] {
  const checks: Check[] = [
    { name: 'end_turn', ok: run.stop_reason === 'end_turn', detail: run.error ?? run.stop_reason ?? 'none' },
  ]
  let json: unknown
  try {
    json = JSON.parse(run.text)
  } catch {
    json = null
  }
  const parsed = cvAnalysisSchema.safeParse(json)
  checks.push({
    name: 'schema',
    ok: parsed.success,
    detail: parsed.success ? '' : (parsed.error.issues[0]?.message ?? 'no JSON'),
  })
  if (!parsed.success) return checks
  const answer = parsed.data

  const over = (Object.keys(CV_LIST_LIMITS) as (keyof typeof CV_LIST_LIMITS)[]).filter(
    (key) => answer[key].length > CV_LIST_LIMITS[key],
  )
  checks.push({
    name: 'limits',
    ok: over.length === 0,
    detail: over.map((key) => `${key} ${answer[key].length}/${CV_LIST_LIMITS[key]}`).join('; '),
  })
  const lower = run.text.toLowerCase()
  const hits = gold.forbidden.filter((phrase) => lower.includes(phrase.toLowerCase()))
  checks.push({ name: 'forbidden', ok: hits.length === 0, detail: hits.join('; ') })
  checks.push({ name: 'is_cv', ok: answer.is_cv === gold.is_cv, detail: `${answer.is_cv}, expected ${gold.is_cv}` })
  if (answer.is_cv !== gold.is_cv) return checks

  checks.push({
    name: 'role',
    ok: gold.accepted_roles.includes(answer.suggested_role),
    detail: `${answer.suggested_role}, expected ${gold.accepted_roles.join(' or ')}`,
  })
  const employers = answer.positions.map((position) => position.employer)
  const missingEmployers = gold.positions
    .map((position) => position.employer)
    .filter((employer) => !employers.some((found) => mentions(found, employer)))
  checks.push({
    name: 'positions',
    ok: answer.positions.length === gold.positions.length && missingEmployers.length === 0,
    detail: [`${answer.positions.length}/${gold.positions.length}`, ...missingEmployers.map((e) => `missing ${e}`)].join(', '),
  })
  for (const skill of gold.must_skills) {
    const found = [skill.name, ...skill.synonyms].some((term) => answer.skills.some((entry) => mentions(entry, term)))
    checks.push({ name: 'must_skills', ok: found, detail: skill.name })
  }
  for (const skill of gold.absent_skills) {
    const hit = answer.skills.find((entry) => mentions(entry, skill))
    checks.push({ name: 'absent_skills', ok: hit === undefined, detail: hit ? `${skill} in "${hit}"` : skill })
  }
  const names = answer.languages.map((language) => language.name)
  const missingLanguages = gold.languages.filter((language) => !names.some((name) => mentions(name, language)))
  checks.push({
    name: 'languages',
    ok: names.length === gold.languages.length && missingLanguages.length === 0,
    detail: [`${names.length}/${gold.languages.length}`, ...missingLanguages.map((l) => `missing ${l}`)].join(', '),
  })
  if (gold.highest_degree !== null) {
    checks.push({
      name: 'highest_degree',
      ok: answer.highest_degree !== null && mentions(answer.highest_degree, gold.highest_degree),
      detail: `${answer.highest_degree}, expected ${gold.highest_degree}`,
    })
  }
  return checks
}

export function tallyChecks(runs: Check[][], into = new Map<string, Tally>()): Map<string, Tally> {
  const items = new Map<string, boolean>()
  for (const results of runs) {
    const seen = new Map<string, number>()
    for (const { name, ok } of results) {
      const index = seen.get(name) ?? 0
      seen.set(name, index + 1)
      const key = `${name}#${index}`
      items.set(key, (items.get(key) ?? true) && ok)
    }
  }
  for (const [key, ok] of items) {
    const name = key.slice(0, key.lastIndexOf('#'))
    const entry = into.get(name) ?? { ok: 0, total: 0 }
    into.set(name, { ok: entry.ok + (ok ? 1 : 0), total: entry.total + 1 })
  }
  return into
}
