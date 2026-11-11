import type { DocumentBlockParam, MessageParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { marked, newMarkId, oneLine, visible } from '../../llm/untrusted.js'
import * as researchConfig from '../company_research/company_research.config.js'
import type { CompanyResearchSource } from '../company_research/company_research.schemas.js'
import { adDocument, markedAd, matchAside } from '../match_analysis/match_analysis.material.js'
import type { CoachMatch, MatchJob } from '../match_analysis/match_analysis.schemas.js'
import * as config from './coach_agent.config.js'
import type {
  CoachApplication,
  CoachResearch,
  HistoryTurn,
} from './coach_agent.schemas.js'
import * as prompt from './coach_agent.texts.js'

export function messageText({ content }: MessageParam): string {
  const text =
    typeof content === 'string'
      ? content
      : content.map((block) => (block.type === 'text' ? block.text : '')).join('')
  return visible(text)
}

export function host(url: string): string | null {
  return URL.canParse(url) ? new URL(url).hostname : null
}

function applicationLine({ id, status, changedAt, job }: CoachApplication): string {
  const line = `Bewerbung ${id}: ${job.title}, ${job.company ?? 'Firma nicht genannt'}, ${job.city}; Status ${prompt.STATUS_LABELS[status]} seit ${changedAt.toISOString().slice(0, 10)}`
  return oneLine(line)
}

export function applicationsAside(applications: CoachApplication[], asOf: string): string {
  const shown = applications.slice(0, config.APPLICATIONS_LIMIT)
  const lines = shown.map((application) => `- ${applicationLine(application)}`).join('\n') || '- keine Bewerbungen'
  const rest = applications.length - shown.length
  const more = rest > 0 ? `\n- … Weitere Bewerbungen, die länger nicht geändert wurden und hier nicht stehen: ${rest}` : ''
  return `<bewerbungen quelle="Bewerbungen der Person in job-match" stand="${asOf}">\n${lines}${more}\n</bewerbungen>`
}

function sourceLine({ url, title }: CompanyResearchSource): string[] {
  const address = host(url)
  if (!address) return []
  const name = oneLine(title ?? '').slice(0, researchConfig.TITLE_MAX_CHARS)
  return [`- ${name ? `${name} (${address})` : address}`]
}

export function researchAside({ company, question, content, sources, createdAt }: CoachResearch): string {
  const cut = content.length > config.RESEARCH_MAX_CHARS
  return [
    `<recherche quelle="Webrecherche für die Person, von ihr freigegeben" datum="${createdAt.toISOString().slice(0, 10)}">`,
    `Firma: ${oneLine(company).slice(0, researchConfig.FIELD_MAX_CHARS)}`,
    `Frage: ${oneLine(question).slice(0, researchConfig.FIELD_MAX_CHARS)}`,
    'Antwort:',
    cut ? `${content.slice(0, config.RESEARCH_MAX_CHARS)} …` : content,
    'Quellen:',
    ...sources.slice(0, config.RESEARCH_SOURCES).flatMap(sourceLine),
    '</recherche>',
  ].join('\n')
}

export function recentHistory(messages: MessageParam[]): { turns: HistoryTurn[]; cut: boolean } {
  const turns = messages
    .map((message) => ({ role: message.role, content: messageText(message) }))
    .filter(({ content }) => content.trim() !== '')
  let chars = 0
  let start = turns.length
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    chars += turns[index].content.length
    if (chars > config.HISTORY_MAX_CHARS) break
    if (turns[index].role === 'user') start = index
  }
  return { turns: turns.slice(start), cut: start > 0 }
}

export function applicationResult(
  application: CoachApplication,
  job: MatchJob,
  match: CoachMatch | null,
): (TextBlockParam | DocumentBlockParam)[] {
  const id = newMarkId()
  const line = `<bewerbung quelle="Bewerbung der Person in job-match">\n${applicationLine(application)}\n</bewerbung>`
  return [
    { type: 'text', text: marked(line, 'bewerbung', id) },
    adDocument(job, markedAd(job, id)) as DocumentBlockParam,
    { type: 'text', text: match ? marked(matchAside(match), 'match', id) : prompt.NO_MATCH },
  ]
}
