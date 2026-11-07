import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { marked, newMarkId } from '../../llm/untrusted.js'
import type { JobExtractInput } from './job_extract.schemas.js'

export function markedText(text: string): string {
  const block = `<stellenanzeige quelle="von der Person eingefügt, Verfasser unbekannt">\n${text}\n</stellenanzeige>`
  return marked(block, 'stellenanzeige', newMarkId())
}

export function materialBlock(input: JobExtractInput, data: string): ContentBlockParam {
  return input.kind === 'text'
    ? { type: 'document', source: { type: 'text', media_type: 'text/plain', data } }
    : { type: 'image', source: { type: 'base64', media_type: input.mediaType, data } }
}
