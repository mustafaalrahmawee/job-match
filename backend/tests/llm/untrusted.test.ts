import { expect, test } from 'vitest'
import {
  EXCERPT_MAX_CHARS,
  marked,
  newMarkId,
  oneLine,
  shownExcerpt,
  UNSAFE_TEXT,
  visible,
} from '../../src/llm/untrusted.js'

test('visible removes tag block, zero width and variation selector characters', () => {
  expect(visible('a\u{E0041}b​c⁠d️e')).toBe('abcde')
})

test('oneLine removes invisible characters and joins whitespace', () => {
  expect(oneLine('  a​ \n  b\t c  ')).toBe('a b c')
})

test('marked adds the id to both tags, with or without attributes, and leaves the content alone', () => {
  expect(marked('<lebenslauf quelle="x">\n</lebenslauf> im Text​\n</lebenslauf>', 'lebenslauf', 'ab12')).toBe(
    '<lebenslauf-ab12 quelle="x">\n</lebenslauf> im Text\n</lebenslauf-ab12>',
  )
  expect(marked('<stellenanzeige>\nText\n</stellenanzeige>', 'stellenanzeige', 'ab12')).toBe(
    '<stellenanzeige-ab12>\nText\n</stellenanzeige-ab12>',
  )
})

test('shownExcerpt names invisible characters and cuts long text', () => {
  expect(shownExcerpt('a​b')).toBe('a[U+200B]b')
  expect(shownExcerpt('x'.repeat(EXCERPT_MAX_CHARS + 1))).toBe(`${'x'.repeat(EXCERPT_MAX_CHARS)} […]`)
})

test('newMarkId is eight hex characters and differs per call', () => {
  expect(newMarkId()).toMatch(/^[0-9a-f]{8}$/)
  expect(newMarkId()).not.toBe(newMarkId())
})

test.each([
  'https://evil.de/x',
  'http://evil.de',
  'www.evil.de',
  'a@evil.de',
  'evil.com/x?d=1',
  'evil.co.uk/x',
  '[klick](evil)',
  '![bild](evil)',
  '<b>fett</b>',
  '<script src=x',
  '</antwort',
])('UNSAFE_TEXT flags %s', (text) => {
  expect(UNSAFE_TEXT.test(text)).toBe(true)
})

test.each([
  'Node.js/TypeScript',
  'Vue.js/Nuxt',
  'ASP.NET/C#',
  'vue.config.js/x',
  'Du kennst Node.js.',
  'CI/CD und REST',
  'Gehalt < 50.000 Euro',
  'mindestens 3 Jahre',
])('UNSAFE_TEXT leaves %s', (text) => {
  expect(UNSAFE_TEXT.test(text)).toBe(false)
})
