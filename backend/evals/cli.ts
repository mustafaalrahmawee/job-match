import type { Variant } from '../src/llm/send.js'
import { writePdfs } from './units/cv_analysis/cv_analysis.pdf.js'

const EFFORTS = ['low', 'medium', 'high'] as const

const [command, unit, times = '1', model, effort] = process.argv.slice(2)
const rounds = Number(times)
const effortOk = effort === undefined || (EFFORTS as readonly string[]).includes(effort)

if (unit !== 'cv_analysis' || (command !== 'pdf' && command !== 'run') || !Number.isInteger(rounds) || rounds < 1 || !effortOk) {
  console.error('Aufruf: pnpm evals pdf cv_analysis | pnpm evals run cv_analysis [Läufe] [Modell] [low|medium|high]')
  process.exitCode = 1
} else if (command === 'pdf') {
  await writePdfs()
} else {
  const { run } = await import('./units/cv_analysis/cv_analysis.run.js')
  const variant: Variant = { model, effort: effort as Variant['effort'] }
  for (let n = 0; n < rounds; n++) await run(variant)
}
