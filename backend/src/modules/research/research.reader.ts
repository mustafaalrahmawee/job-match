import type { PrismaClient } from '../../generated/prisma/client.js'
import * as coachConfig from '../../prompts/coach_agent/coach_agent.config.js'
import type { CoachResearch } from '../../prompts/coach_agent/coach_agent.schemas.js'
import type { CompanyResearchSource } from '../../prompts/company_research/company_research.schemas.js'

export class ResearchReader {
  constructor(private readonly prisma: PrismaClient) { }

  async confirmed(userId: number, conversationId: number): Promise<CoachResearch[]> {
    const researches = await this.prisma.companyResearch.findMany({
      where: { userId, conversationId, confirmedAt: { not: null } },
      orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }],
      take: coachConfig.RESEARCH_LIMIT,
      select: { company: true, question: true, content: true, sources: true, createdAt: true },
    })
    return researches.map((research) => ({ ...research, sources: research.sources as CompanyResearchSource[] }))
  }
}
