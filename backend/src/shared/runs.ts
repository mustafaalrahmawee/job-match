import type { LlmRun, LlmUnit, Prisma } from '../generated/prisma/client.js'
import { AppError } from './errors.js'

export const RUNS_PER_DAY: Record<LlmUnit, number> = {
  cv_analysis: 5,
  job_extract: 20,
  match_analysis: 5,
  company_research: 5,
  coach_agent: 50,
}

export async function claimRun(
  tx: Prisma.TransactionClient,
  userId: number,
  unit: LlmUnit,
  now: Date,
  run: { model?: string; effort?: string | null; jobId?: number } = {},
): Promise<LlmRun> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
  const today = await tx.llmRun.count({
    where: { userId, unit, createdAt: { gte: new Date(now.toISOString().slice(0, 10)) } },
  })
  if (today >= RUNS_PER_DAY[unit]) throw new AppError(429, 'limit_reached')
  return tx.llmRun.create({ data: { userId, unit, ...run, createdAt: now } })
}
