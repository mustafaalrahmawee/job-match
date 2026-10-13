import { franc } from 'franc'

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
    { name: 'max_words', ok: words <= gold.max_words, detail: `${words}/${gold.max_words}` },
    { name: 'forbidden', ok: hits.length === 0, detail: hits.join('; ') },
  ]
}
