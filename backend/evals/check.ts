import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type CoachChatGold, coachChatChecks, type RunRecord } from './checks.js'
import { EVALS, readJson, RUNS, sampleNames } from './run.js'

const THRESHOLD: Record<string, number> = { coach_chat: 1 }

export function check(unit: string, fassung: string): void {
  const threshold = THRESHOLD[unit]
  if (threshold === undefined) throw new Error(`evals check does not know the unit ${unit}`)
  const dir = join(EVALS, unit, 'runs', fassung)
  const metaPath = join(dir, 'meta.json')
  if (!existsSync(metaPath)) throw new Error(`${metaPath} is missing; run evals run first`)
  const meta = readJson<{ model: string; effort: string; quality?: string; cost_usd?: number }>(metaPath)

  const quality = meta.quality ? `, quality ${meta.quality}` : ''
  const lines = [`${unit} ${fassung}: ${meta.model}, effort ${meta.effort}${quality}`, '']
  let passed = 0
  const names = sampleNames(unit)
  for (const name of names) {
    const gold = readJson<CoachChatGold>(join(EVALS, unit, 'samples', name, 'gold.json'))
    const failures = RUNS.flatMap((n) => {
      const path = join(dir, name, `run-${n}.json`)
      if (!existsSync(path)) return [`run ${n}: missing`]
      return coachChatChecks(gold, readJson<RunRecord>(path))
        .filter((result) => !result.ok)
        .map((result) => `run ${n}: ${result.name} (${result.detail})`)
    })
    if (!failures.length) passed += 1
    lines.push(`${failures.length ? 'FAIL' : 'ok  '}  ${name}`, ...failures.map((failure) => `        ${failure}`))
  }

  const share = passed / names.length
  lines.push(
    '',
    `Cases right in all ${RUNS.length} runs: ${passed}/${names.length} (${Math.round(share * 100)} %), threshold ${threshold * 100} %`,
    `Verdict: ${share >= threshold ? 'above the threshold' : 'below the threshold'}`,
    `Cost: $${(meta.cost_usd ?? 0).toFixed(4)}`,
  )
  const text = `${lines.join('\n')}\n`
  writeFileSync(join(dir, 'check.txt'), text)
  console.log(text)
}
