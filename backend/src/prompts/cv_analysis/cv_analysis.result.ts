import {
  CV_ENTRY_MAX_CHARS,
  CV_EXCERPT_MAX_CHARS,
  CV_LIST_LIMITS,
  CV_SUSPICIOUS_MAX_ENTRIES,
  INVISIBLE_CHARS,
} from './cv_analysis.config.js'
import type { CvAnalysis, CvAnalysisOutput, SuspiciousText } from './cv_analysis.schemas.js'

const TAG_BLOCK = /[\u{E0000}-\u{E007F}]/u
const UNSAFE_ENTRY = /https?:\/\/|\bwww\.|[\w.+-]+@[\w-]+\.[a-z]{2,}|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\/|!?\[[^\]]*\]\(|<\/?[a-z][^<>]*>/iu

export function cvAnalysisResult(output: CvAnalysisOutput): {
  analysis: CvAnalysis
  suspiciousText: SuspiciousText
  hits: number
} {
  const { suspicious_text, ...analysis } = output
  let hits = 0
  const clean = (text: string | null): string | null | undefined => {
    if (text === null) return null
    const visible = text.replace(INVISIBLE_CHARS, '')
    if (visible.length > CV_ENTRY_MAX_CHARS || UNSAFE_ENTRY.test(visible)) {
      hits++
      return undefined
    }
    if (TAG_BLOCK.test(text)) hits++
    return visible
  }
  const texts = (items: string[], limit: number) =>
    [...new Set(items.map((item) => clean(item)).filter((item) => typeof item === 'string'))].slice(0, limit)
  const records = <T extends Record<string, string | boolean | null>>(items: T[], limit: number) =>
    items
      .flatMap((item) => {
        const fields = Object.entries(item).map(
          ([key, value]) => [key, typeof value === 'boolean' ? value : clean(value)] as const,
        )
        return fields.some(([, value]) => value === undefined) ? [] : [Object.fromEntries(fields) as T]
      })
      .slice(0, limit)
  const education = records(analysis.education, CV_LIST_LIMITS.education)
  const highest = clean(analysis.highest_degree)
  const result: CvAnalysis = {
    ...analysis,
    language: clean(analysis.language) ?? '',
    positions: records(analysis.positions, CV_LIST_LIMITS.positions).map((position) =>
      position.ongoing ? { ...position, end: null } : position,
    ),
    skills: texts(analysis.skills, CV_LIST_LIMITS.skills),
    education,
    highest_degree: education.find((entry) => entry.degree === highest)?.degree ?? null,
    languages: records(analysis.languages, CV_LIST_LIMITS.languages),
    strengths: texts(analysis.strengths, CV_LIST_LIMITS.strengths),
    weaknesses: texts(analysis.weaknesses, CV_LIST_LIMITS.weaknesses),
    tips: texts(analysis.tips, CV_LIST_LIMITS.tips),
  }
  const suspiciousText = suspicious_text.slice(0, CV_SUSPICIOUS_MAX_ENTRIES).map(({ kind, excerpt }) => {
    const shown = excerpt.replace(INVISIBLE_CHARS, (char) => `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`)
    return {
      kind,
      excerpt: shown.length > CV_EXCERPT_MAX_CHARS ? `${shown.slice(0, CV_EXCERPT_MAX_CHARS)} […]` : shown,
    }
  })
  return { analysis: result, suspiciousText, hits }
}
