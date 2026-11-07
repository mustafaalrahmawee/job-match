import { randomBytes } from 'node:crypto'

export const SUSPICIOUS_MAX_ENTRIES = 10
export const EXCERPT_MAX_CHARS = 1000

export const INVISIBLE_CHARS = /[\u{E0000}-\u{E007F}\u{200B}-\u{200D}\u{2060}]|[\u{FE00}-\u{FE0F}]/gu
export const TAG_BLOCK = /[\u{E0000}-\u{E007F}]/u
export const ADDRESS = /https?:\/\/[^\s)\]>]+/giu
export const UNSAFE_TEXT =
  /https?:\/\/|\bwww\.|[\w.+-]+@[\w-]+\.[a-z]{2,}|\b(?:[a-z0-9-]+\.)+(?!js\/|net\/)[a-z]{2,}\/|!?\[[^\]]*\]\(|<\/?[a-z]/iu

export function newMarkId(): string {
  return randomBytes(4).toString('hex')
}

export function visible(text: string): string {
  return text.replace(INVISIBLE_CHARS, '')
}

export function oneLine(text: string): string {
  return visible(text).replace(/\s+/gu, ' ').trim()
}

export function marked(block: string, tag: string, id: string): string {
  return visible(block)
    .replace(new RegExp(`^<${tag}(?=[ >])`, 'u'), `<${tag}-${id}`)
    .replace(new RegExp(`</${tag}>$`, 'u'), `</${tag}-${id}>`)
}

export function shownExcerpt(text: string): string {
  const shown = text.replace(INVISIBLE_CHARS, (char) => `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`)
  return shown.length > EXCERPT_MAX_CHARS ? `${shown.slice(0, EXCERPT_MAX_CHARS)} […]` : shown
}
