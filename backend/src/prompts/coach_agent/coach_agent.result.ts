import { ADDRESS, INVISIBLE_CHARS } from '../../llm/untrusted.js'
import { COACH_AGENT_RESEARCH_LIMIT } from './coach_agent.config.js'
import { host } from './coach_agent.material.js'
import type { CoachResearch } from './coach_agent.schemas.js'

const FILE_TAG = /<\/?(?:lebenslauf|bewerbungen?|recherche|stellenanzeige|match)\b/giu

export function researchHits(researches: CoachResearch[]): number {
  const read = researches.slice(0, COACH_AGENT_RESEARCH_LIMIT)
  const hosts = new Set(read.flatMap(({ sources }) => sources.map(({ url }) => host(url))))
  const text = read
    .flatMap(({ company, question, content, sources }) => [company, question, content, ...sources.map(({ title }) => title ?? '')])
    .join('\n')
  const addresses = [...text.matchAll(ADDRESS)].filter(([address]) => !hosts.has(host(address)))
  return addresses.length + (text.match(FILE_TAG)?.length ?? 0) + (text.match(INVISIBLE_CHARS)?.length ?? 0)
}
