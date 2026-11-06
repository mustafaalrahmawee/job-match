import type { PrismaClient } from '../../generated/prisma/client.js'
import { COACH_AGENT_RESEARCH_LIMIT, type CoachResearch } from '../../prompts/coach_agent.js'
import type { CompanyResearchSource } from '../../prompts/company_research.js'

export class ResearchReader {
  constructor(private readonly prisma: PrismaClient) { }

  async confirmed(userId: number, conversationId: number): Promise<CoachResearch[]> {
    const researches = await this.prisma.companyResearch.findMany({
      where: { userId, conversationId, confirmedAt: { not: null } },
      orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }],
      take: COACH_AGENT_RESEARCH_LIMIT,
      select: { company: true, question: true, content: true, sources: true, createdAt: true },
    })
    return researches.map((research) => ({ ...research, sources: research.sources as CompanyResearchSource[] }))
  }
}
