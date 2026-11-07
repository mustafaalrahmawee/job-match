import { oneLine, shownExcerpt, SUSPICIOUS_MAX_ENTRIES, UNSAFE_TEXT } from '../../llm/untrusted.js'
import { cvAside } from '../cv_analysis/cv_analysis.material.js'
import type { CoachCv } from '../cv_analysis/cv_analysis.schemas.js'
import * as config from './match_analysis.config.js'
import { adText } from './match_analysis.material.js'
import type { MatchAnalysis, MatchAnalysisOutput, MatchJob } from './match_analysis.schemas.js'

const NUMBER_WORDS: Record<string, string> = {
  zwei: '2', two: '2', drei: '3', three: '3', vier: '4', four: '4', fünf: '5', five: '5', sechs: '6', six: '6',
  sieben: '7', seven: '7', acht: '8', eight: '8', neun: '9', nine: '9', zehn: '10', ten: '10', elf: '11', zwölf: '12',
}
const NUMBER_WORD = new RegExp(`(?<!\\p{L})(?:${Object.keys(NUMBER_WORDS).join('|')})(?!\\p{L})`, 'gu')
const NUMBER = /(\d+(?:[.,]\d+)?)(\+?[\s-]*(?:berufs)?(?:jahr|jähr|year))?/gu
const NAME = /[\p{L}\p{N}][\p{L}\p{N}#+]*(?:\.[\p{L}\p{N}]+)*/gu
const NAME_SPELLING = /\p{Ll}\p{Lu}|\p{Lu}{2}|\p{L}[#+]|\.\p{Ll}{2}/u
const CALENDAR_YEAR = /\b(?:19|20)\d{2}\b/u

export function matchAnalysisResult(output: MatchAnalysisOutput): {
  analysis: MatchAnalysis
  suspiciousText: string[]
  hits: number
} {
  let hits = 0
  const shortQuote = <Q extends string | null>(quote: Q) =>
    (quote === null ? null : oneLine(quote).slice(0, config.ENTRY_MAX_CHARS)) as Q
  const entries = <T extends { ad_quote: string | null; cv_quote: string | null; text: string }>(items: T[]) =>
    items.flatMap((item) => {
      const entry = {
        ...item,
        ad_quote: shortQuote(item.ad_quote),
        cv_quote: shortQuote(item.cv_quote),
        text: oneLine(item.text),
      }
      if (entry.text.length > config.ENTRY_MAX_CHARS || UNSAFE_TEXT.test(entry.text)) {
        hits++
        return []
      }
      return entry.text && entry.ad_quote !== '' && entry.cv_quote !== '' ? [entry] : []
    })
  const named = <T extends { names: string[] }>(items: T[]) =>
    items.map((item) => ({
      ...item,
      names: item.names
        .map((name) => oneLine(name).slice(0, config.NAME_MAX_CHARS))
        .filter(Boolean)
        .slice(0, config.ENTRY_MAX_NAMES),
    }))
  const analysis = {
    gaps: named(entries(output.gaps)).slice(0, config.LIST_LIMITS.gaps),
    strengths: named(entries(output.strengths)).slice(0, config.LIST_LIMITS.strengths),
    score: output.score,
    tips: entries(output.tips).slice(0, config.LIST_LIMITS.tips),
  }
  const suspiciousText = output.suspicious_text.slice(0, SUSPICIOUS_MAX_ENTRIES).map(shownExcerpt)
  return { analysis, suspiciousText, hits }
}

function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(NUMBER_WORD, (word) => NUMBER_WORDS[word])
    .replace(/\s+/gu, ' ')
    .trim()
}

function stationYears({ analysis, asOf }: CoachCv): number {
  return analysis.positions.reduce((sum, { start, ongoing, end }) => {
    const from = start?.match(CALENDAR_YEAR)?.[0]
    const to = (ongoing ? asOf : end)?.match(CALENDAR_YEAR)?.[0]
    return from && to ? sum + Number(to) - Number(from) + 1 : sum
  }, 0)
}

export function missingFacts({ gaps, strengths }: MatchAnalysis, cv: CoachCv, job: MatchJob): number {
  const lines = cvAside(cv, config.CV_SECTIONS)
    .split('\n')
    .filter((line) => line.startsWith('- '))
  const material = comparable([adText(job), ...lines].join('\n'))
  const numbers = new Set([...material.matchAll(NUMBER)].map(([, number]) => number))
  const years = stationYears(cv)
  const missing = ({ text, names }: { text: string; names: string[] }) => [
    ...[...comparable(text).matchAll(NUMBER)].filter(
      ([, number, unit]) => !numbers.has(number) && !(unit && Number(number.replace(',', '.')) <= years),
    ),
    ...[...names, ...(text.match(NAME) ?? []).filter((name) => NAME_SPELLING.test(name))].filter(
      (name) => !material.includes(comparable(name.replace(/(?<=\p{Lu})s$/u, ''))),
    ),
  ]
  return [...gaps, ...strengths].flatMap(missing).length
}
