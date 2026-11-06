import type { RequestHandler, Response } from 'express'
import type { CompanyResearch } from '../../generated/prisma/client.js'
import type { CompanyResearchSource } from '../../prompts/company_research.js'
import { authOf } from '../../shared/auth.middleware.js'
import {
  researchConversationIdSchema,
  researchIdSchema,
  researchInputSchema,
  type ResearchOutput,
  type ResearchStep,
} from './research.schemas.js'
import type { ResearchHandlers, ResearchReply, ResearchService } from './research.service.js'

export class ResearchController {
  constructor(private readonly research: ResearchService) { }

  list: RequestHandler = async (req, res) => {
    const conversationId = researchConversationIdSchema.parse(req.params.conversationId)
    const researches = await this.research.list(authOf(req).user.id, conversationId)
    res.json(researches.map(output))
  }

  run: RequestHandler = async (req, res) => {
    const conversationId = researchConversationIdSchema.parse(req.params.conversationId)
    const input = researchInputSchema.parse(req.body)
    const run = await this.research.start(authOf(req).user.id, conversationId, input)
    await streamRun(res, (handlers) => this.research.finish(run, handlers))
  }

  confirm: RequestHandler = async (req, res) => {
    const id = researchIdSchema.parse(req.params.id)
    res.json(output(await this.research.confirm(authOf(req).user.id, id)))
  }
}

function output(research: CompanyResearch): ResearchOutput {
  return {
    id: research.id,
    conversation_id: research.conversationId,
    company: research.company,
    question: research.question,
    text: research.content,
    steps: research.steps as ResearchStep[],
    sources: research.sources as CompanyResearchSource[],
    suspicious_text: research.suspiciousText,
    suspicious_sources: research.suspiciousSources as CompanyResearchSource[],
    confirmed_at: research.confirmedAt,
    created_at: research.createdAt,
  }
}

async function streamRun(res: Response, run: (handlers: ResearchHandlers) => Promise<ResearchReply>): Promise<void> {
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableFinished) abort.abort()
  })
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  try {
    const { research, outcome } = await run({
      onStep: (step) => res.write(`event: step\ndata: ${JSON.stringify(step)}\n\n`),
      signal: abort.signal,
    })
    res.write(`event: done\ndata: ${JSON.stringify({ research: research && output(research), outcome })}\n\n`)
  } catch (error) {
    console.error(error)
    res.write(`event: error\ndata: ${JSON.stringify({ detail: 'The research failed' })}\n\n`)
  }
  res.end()
}
