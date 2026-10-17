import { expect, test } from 'vitest'
import { coachChatChecks, countWords, detectLanguage, type RunRecord } from '../../evals/checks.js'

const GOLD = { language: 'de', declines_scope: false, forbidden: ['laut deinem Lebenslauf'], max_words: 20 }

function answer(text: string, stop_reason = 'end_turn'): RunRecord {
  return { text, stop_reason, input_tokens: 0, output_tokens: 0, cost_usd: 0, error: null }
}

function failed(text: string, stop_reason?: string): string[] {
  return coachChatChecks(GOLD, answer(text, stop_reason))
    .filter((result) => !result.ok)
    .map((result) => result.name)
}

test('markdown bullets do not count as words', () => {
  expect(countWords('**Tipp:**\n- Nenne [Firma] konkret\n- 3 Beispiele')).toBe(6)
})

test('the language is detected as an ISO 639-1 code', () => {
  expect(detectLanguage('Schreib im Anschreiben zuerst, warum dich genau diese Stelle in [Firma] interessiert.')).toBe('de')
  expect(detectLanguage('Start with the number you want and explain why it fits the role you applied for.')).toBe('en')
  expect(detectLanguage('Почніть з короткої відповіді і поясніть, що ви вже робите, щоб покращити німецьку.')).toBe('uk')
})

test('a short German answer passes every check', () => {
  expect(failed('Nenne im Gespräch eine echte Schwäche und sag, was du schon dagegen tust.')).toEqual([])
})

test('up to ten percent over max_words is a benign divergence', () => {
  expect(failed('Nenne im Gespräch eine echte Schwäche und sag dann ruhig, was du schon dagegen tust, zum Beispiel einen kleinen Kurs mit Prüfung.')).toEqual([])
  expect(failed('Nenne im Gespräch eine echte Schwäche und sag dann ruhig, was du schon dagegen tust, zum Beispiel einen kleinen neuen Kurs mit Prüfung.')).toEqual(['max_words'])
})

test('each failure is reported by its own check', () => {
  expect(failed('Laut deinem Lebenslauf bist du sehr erfahren im Lager.')).toEqual(['forbidden'])
  expect(failed('Name a real weakness in the interview and say what you already do about it.')).toEqual(['language'])
  expect(failed('Nenne eine echte Schwäche und sag dann', 'max_tokens')).toEqual(['end_turn'])
  expect(failed('')).toEqual(['not_empty', 'language'])
  expect(failed('Nenne im Gespräch eine echte Schwäche. '.repeat(5))).toEqual(['max_words'])
})

test('expected mentions pass when one term appears as a whole word', () => {
  const gold = { ...GOLD, expected_mentions: ['drei Jahre', '3 Jahre'] }
  const names = (text: string) => coachChatChecks(gold, answer(text)).filter((r) => !r.ok).map((r) => r.name)
  expect(names('Du arbeitest seit gut 3 Jahren als Entwicklerin.')).toEqual(['expected_mentions'])
  expect(names('Du hast rund drei Jahre Berufserfahrung im Frontend.')).toEqual([])
  expect(coachChatChecks(GOLD, answer('Hallo')).map((r) => r.name)).not.toContain('expected_mentions')
})
