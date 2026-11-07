import { JOB_LIMITS, JOB_TEXT_MAX_CHARS, type JobDraft } from '../../modules/jobs/jobs.schemas.js'
import { INVISIBLE_CHARS, JOB_EXCERPT_MAX_CHARS, JOB_SUSPICIOUS_MAX_ENTRIES } from './job_extract.config.js'
import type { JobExtract, JobExtractInput, JobExtractResult, LineField } from './job_extract.schemas.js'

const REMOTE_CITY = 'Remote'

const TAG_BLOCK = /[\u{E0000}-\u{E007F}]/u
const UNSAFE_FIELD = /https?:\/\/|\bwww\.|[\w.+-]+@[\w-]+\.[a-z]{2,}|!?\[[^\]]*\]\(|<\/?[a-z][^<>]*>/iu
const TOKEN_START = /^[\p{L}\p{N}]/u
const TOKEN_END = /[\p{L}\p{N}]$/u
const BEFORE_TOKEN = '(?<![\\p{L}\\p{N}]|\\p{N}[.,])'
const AFTER_TOKEN = '(?![\\p{L}\\p{N}]|[.,]\\p{N})'

function comparable(text: string): string {
  return text
    .replace(INVISIBLE_CHARS, '')
    .replace(/[‐-―]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()
}

function occurs(material: string, value: string): boolean {
  const literal = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const start = TOKEN_START.test(value) ? BEFORE_TOKEN : ''
  const end = TOKEN_END.test(value) ? AFTER_TOKEN : ''
  return new RegExp(`${start}${literal}${end}`, 'u').test(material)
}

export function jobExtractResult(output: JobExtract, input: JobExtractInput): JobExtractResult {
  const material = input.kind === 'text' ? comparable(input.text) : null
  const unverified: LineField[] = []
  let hits = 0
  const line = (field: LineField): string | null => {
    const raw = output[field]
    if (raw === null) return null
    if (TAG_BLOCK.test(raw)) hits++
    const value = raw.replace(INVISIBLE_CHARS, '').replace(/\s+/gu, ' ').trim()
    if (UNSAFE_FIELD.test(value)) {
      hits++
      return null
    }
    const parts = field === 'city' ? value.split(',') : [value]
    const found = (part: string) =>
      material === null || (field === 'city' && part.trim() === REMOTE_CITY) || occurs(material, comparable(part))
    if (!parts.every(found)) {
      unverified.push(field)
      hits++
    }
    return value.slice(0, JOB_LIMITS[field]) || null
  }
  const description = input.kind === 'text' ? input.text : (output.text ?? '')
  if (TAG_BLOCK.test(description)) hits++
  const draft: JobDraft = {
    title: line('title'),
    company: line('company'),
    city: line('city'),
    offer_type: output.offer_type,
    full_time: output.full_time,
    part_time: output.part_time,
    salary: line('salary'),
    description: description.replace(INVISIBLE_CHARS, '').slice(0, JOB_TEXT_MAX_CHARS),
  }
  const suspiciousText = output.suspicious_text.slice(0, JOB_SUSPICIOUS_MAX_ENTRIES).map((entry) => {
    const shown = entry.replace(INVISIBLE_CHARS, (char) => `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`)
    return shown.length > JOB_EXCERPT_MAX_CHARS ? `${shown.slice(0, JOB_EXCERPT_MAX_CHARS)} […]` : shown
  })
  return { draft, suspiciousText, unverified, hits }
}
