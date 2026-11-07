import type { OutputConfig } from '@anthropic-ai/sdk/resources/messages'

export type Variant = { model?: string; effort?: OutputConfig['effort'] }

export type CompanyResearchInput = { company: string; question: string }

export type CompanyResearchSource = { url: string; title: string | null }

export type CompanyResearchResult = {
  text: string
  suspiciousText: string | null
  sources: CompanyResearchSource[]
  suspiciousSources: CompanyResearchSource[]
  queries: string[]
  searchResults: CompanyResearchSource[]
  hits: number
}
