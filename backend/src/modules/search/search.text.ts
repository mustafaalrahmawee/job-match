import type { Job } from '../../generated/prisma/client.js'
import { ADDRESS, EMAIL, HIDDEN_HTML, HTML_TAG, oneLine, TAG_BLOCK, visible } from '../../llm/untrusted.js'
import type { CvAnalysis } from '../../prompts/cv_analysis/cv_analysis.schemas.js'
import { JOB_TEXT_MAX_CHARS } from '../jobs/jobs.schemas.js'
import * as config from './search.config.js'

export type JobText = { text: string; tagCharacters: number; hiddenElements: number }

const TAG_NAME = /^<(\/?)([a-z][a-z0-9-]*)/iu
const IMAGE = /!\[[^\]]*\]\([^)]*\)/gu
const LINK = /\[([^\]]*)\]\([^)]*\)/gu
const TABLE_RULE = /^[\s|:-]*[|:-][\s|:-]*$/u
const HEADING = /^\s*#+\s*/u
const LIST_MARK = /^\s*[-*+]\s+/u
const QUOTE = /^\s*>\s?/u
const EMPHASIS = /\*\*|__/gu
const SINGLE_STAR = /(?<![\p{L}\p{N}*])\*(?=[^\s*])|(?<=[^\s*])\*(?![\p{L}\p{N}*])/gu
const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu
const ESCAPE = /\\([\\`*_{}[\]()#+\-.!|>~<])/gu
const GENDER = /\((?:[mwdfxi](?:\s*[/|]\s*[mwdfxi]){1,3}|all genders|gn)\)/giu

export function cvText(analysis: CvAnalysis): string {
  const clean = (values: (string | null)[]) =>
    values.flatMap((value) => {
      const text = value === null ? '' : oneLine(value).normalize('NFC')
      return text ? [text] : []
    })
  const lines: [string, string[]][] = [
    [config.CV_LABELS.positions, [...new Set(clean(analysis.positions.map((position) => position.title)))]],
    [config.CV_LABELS.skills, clean(analysis.skills)],
    [config.CV_LABELS.degrees, [...new Set(clean(analysis.education.map((entry) => entry.degree)))]],
    [
      config.CV_LABELS.languages,
      analysis.languages.flatMap((language) => {
        const [name] = clean([language.name])
        const [level] = clean([language.level])
        return name ? [level ? `${name} (${level})` : name] : []
      }),
    ],
  ]
  return lines
    .filter(([, values]) => values.length)
    .map(([label, values]) => label + values.join(', '))
    .join('\n')
}

export function jobText(job: Pick<Job, 'title' | 'description'>): JobText {
  const read = `${job.title}\n\n${job.description.slice(0, JOB_TEXT_MAX_CHARS)}`
  const tagCharacters = [...read].filter((char) => TAG_BLOCK.test(char)).length
  const { text: shown, hidden } = withoutHidden(visible(read).normalize('NFC'))
  const untagged = shown
    .replace(HTML_TAG, (tag) => (config.BLOCK_TAGS.has(TAG_NAME.exec(tag)![2].toLowerCase()) ? '\n' : ''))
    .replace(ENTITY, (entity: string, decimal?: string, hex?: string, name?: string) => {
      if (name) return config.HTML_ENTITIES.get(name.toLowerCase()) ?? entity
      const code = decimal ? Number(decimal) : parseInt(hex!, 16)
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity
    })
  const text = visible(untagged)
    .replace(ESCAPE, '$1')
    .replaceAll(config.UNREADABLE, '')
    .replace(IMAGE, '')
    .replace(LINK, '$1')
    .replace(ADDRESS, '')
    .replace(EMAIL, config.EMAIL_PLACEHOLDER)
    .split('\n')
    .filter((line) => !TABLE_RULE.test(line))
    .map((line) =>
      line
        .replace(HEADING, '')
        .replace(LIST_MARK, '')
        .replace(QUOTE, '')
        .replace(EMPHASIS, '')
        .replace(SINGLE_STAR, '')
        .replace(EMAIL, config.EMAIL_PLACEHOLDER)
        .replace(GENDER, '')
        .replaceAll('|', ' ')
        .replace(/[ \t]+/gu, ' ')
        .trim(),
    )
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
  return { text, tagCharacters, hiddenElements: hidden }
}

function withoutHidden(text: string): { text: string; hidden: number } {
  let hidden = 0
  let rest = text.replace(new RegExp(HIDDEN_HTML.source, 'giu'), (match: string, element?: string, marked?: string) => {
    if (element || marked) return match
    hidden += 1
    return ''
  })
  let kept = ''
  for (let found = HIDDEN_HTML.exec(rest); found; found = HIDDEN_HTML.exec(rest)) {
    kept += rest.slice(0, found.index)
    hidden += 1
    const name = (found[1] ?? found[2])?.toLowerCase()
    const after = found.index + found[0].length
    rest = rest.slice(name && !config.VOID_TAGS.has(name) ? closingEnd(rest, after, name) : after)
  }
  return { text: kept + rest, hidden }
}

function closingEnd(text: string, from: number, name: string): number {
  let depth = 1
  for (const tag of text.slice(from).matchAll(HTML_TAG)) {
    const [, slash, tagName] = TAG_NAME.exec(tag[0])!
    if (tagName.toLowerCase() !== name) continue
    depth += slash ? -1 : 1
    if (!depth) return from + tag.index + tag[0].length
  }
  return text.length
}
