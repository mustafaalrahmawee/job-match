import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages'
import {
  COMPANY_RESEARCH_ANSWER_TAG,
  COMPANY_RESEARCH_FLAG_TAG,
  COMPANY_RESEARCH_TITLE_MAX_CHARS,
  INVISIBLE_CHARS,
} from './company_research.config.js'
import type { CompanyResearchResult, CompanyResearchSource } from './company_research.schemas.js'

const ANSWER_SHAPE = `<${COMPANY_RESEARCH_ANSWER_TAG}></${COMPANY_RESEARCH_ANSWER_TAG}>`
const FLAG_SHAPE = `<${COMPANY_RESEARCH_FLAG_TAG}></${COMPANY_RESEARCH_FLAG_TAG}>`

const TAG = /<[\p{L}/!?][^<>]*>?/gu
const ENTITY = /&(amp|lt|gt|quot|apos);/g
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const ADDRESS = /https?:\/\/[^\s)\]>]+/giu

export function companyResearchResult(content: ContentBlock[]): CompanyResearchResult {
  let hits = 0
  const visible = (raw: string) => {
    const text = raw.replace(INVISIBLE_CHARS, '')
    if (text !== raw) hits++
    return text
  }
  const line = (raw: string) => visible(raw).replace(/\s+/gu, ' ').trim()
  const usable = (sources: CompanyResearchSource[], protocols: string[]) => {
    const kept = new Map<string, string | null>()
    for (const { url, title } of sources) {
      const address = URL.canParse(url) ? new URL(url) : null
      if (address && protocols.includes(address.protocol)) {
        kept.set(address.href, title === null ? null : line(title).slice(0, COMPANY_RESEARCH_TITLE_MAX_CHARS) || null)
      } else hits++
    }
    return [...kept].map(([url, title]) => ({ url, title }))
  }
  const afterLastSearch = content.slice(content.map((block) => block.type).lastIndexOf('web_search_tool_result') + 1)
  const textBlocks = afterLastSearch.flatMap((block) => (block.type === 'text' ? [block] : []))
  const parts = textBlocks.map((block) => visible(block.text))
  const written = parts.join('')
  const tags = [...written.matchAll(TAG)]
  const shape = tags.map((tag) => tag[0]).join('')
  const valid = shape === ANSWER_SHAPE || shape === ANSWER_SHAPE + FLAG_SHAPE
  if (!valid) hits++
  const span = (at: number): [number, number] | null =>
    valid && tags[at] ? [tags[at].index + tags[at][0].length, tags[at + 1].index] : null
  const inner = (range: [number, number] | null) =>
    range
      ? written
          .slice(...range)
          .replace(ENTITY, (_, name: string) => ENTITIES[name])
          .trim()
      : ''
  let offset = 0
  const placed = textBlocks.map((block, index) => {
    const start = offset
    offset += parts[index].length
    return { citations: block.citations ?? [], start, end: offset }
  })
  const blank = (from: number, to: number) => written.slice(from, to).trim() === ''
  const cited = (at: number) => {
    const range = span(at)
    if (!range) return []
    const first = tags[at].index
    const last = tags[at + 1].index + tags[at + 1][0].length
    return usable(
      placed
        .filter(
          ({ start, end }) =>
            !blank(Math.max(start, range[0]), Math.min(end, range[1])) &&
            blank(start, Math.min(end, first)) &&
            blank(Math.max(start, last), end),
        )
        .flatMap(({ citations }) => citations)
        .flatMap((citation) => (citation.type === 'web_search_result_location' ? [citation] : [])),
      ['https:'],
    )
  }
  const queries = content.flatMap((block) => {
    if (block.type !== 'server_tool_use' || block.name !== 'web_search') return []
    const { query } = block.input as { query?: unknown }
    return typeof query === 'string' ? [line(query)] : []
  })
  const results = content.flatMap((block) => (block.type === 'web_search_tool_result' ? [block.content] : []))
  hits += results.filter((result) => !Array.isArray(result) && result.error_code === 'max_uses_exceeded').length
  const searchResults = usable(results.flatMap((result) => (Array.isArray(result) ? result : [])), ['http:', 'https:'])
  const hosts = new Set(searchResults.map(({ url }) => new URL(url).host))
  for (const address of written.match(ADDRESS) ?? []) {
    if (!URL.canParse(address) || !hosts.has(new URL(address).host)) hits++
  }
  return {
    text: inner(span(0)),
    suspiciousText: inner(span(2)) || null,
    sources: cited(0),
    suspiciousSources: cited(2),
    queries,
    searchResults,
    hits,
  }
}
