import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Check,
  type CoachChatGold,
  coachChatChecks,
  type CvAnalysisGold,
  cvAnalysisChecks,
  type RunRecord,
  type Tally,
  tallyChecks,
} from './checks.js'
import { EVALS, readJson, RUNS, sampleNames } from './run.js'

type Unit = { checks(gold: unknown, run: RunRecord): Check[]; thresholds: Record<string, number> }

const UNITS: Record<string, Unit> = {
  coach_chat: {
    checks: (gold: CoachChatGold, run) => coachChatChecks(gold, run),
    thresholds: { end_turn: 1, not_empty: 1, language: 1, max_words: 1, forbidden: 1 },
  },
  cv_analysis: {
    checks: (gold: CvAnalysisGold, run) => cvAnalysisChecks(gold, run),
    thresholds: {
      end_turn: 1,
      schema: 1,
      limits: 1,
      forbidden: 1,
      is_cv: 1,
      role: 0.9,
      positions: 1,
      must_skills: 0.95,
      absent_skills: 1,
    },
  },
}

export function check(unit: string, fassung: string): void {
  const definition = UNITS[unit]
  if (!definition) throw new Error(`evals check does not know the unit ${unit}`)
  const dir = join(EVALS, unit, 'runs', fassung)
  const metaPath = join(dir, 'meta.json')
  if (!existsSync(metaPath)) throw new Error(`${metaPath} is missing; run evals run first`)
  const meta = readJson<{ model: string; effort: string; quality?: string; cost_usd?: number }>(metaPath)

  const quality = meta.quality ? `, quality ${meta.quality}` : ''
  const lines = [`${unit} ${fassung}: ${meta.model}, effort ${meta.effort}${quality}`, '']
  const tallies = new Map<string, Tally>()
  let passed = 0
  const names = sampleNames(unit)
  for (const name of names) {
    const gold = readJson<unknown>(join(EVALS, unit, 'samples', name, 'gold.json'))
    const runs: Check[][] = []
    const failures: string[] = []
    for (const n of RUNS) {
      const path = join(dir, name, `run-${n}.json`)
      if (!existsSync(path)) {
        failures.push(`run ${n}: missing`)
        continue
      }
      const results = definition.checks(gold, readJson<RunRecord>(path))
      runs.push(results)
      failures.push(...results.filter((r) => !r.ok).map((r) => `run ${n}: ${r.name} (${r.detail})`))
    }
    tallyChecks(runs, tallies)
    if (!failures.length) passed += 1
    lines.push(`${failures.length ? 'FAIL' : 'ok  '}  ${name}`, ...failures.map((failure) => `        ${failure}`))
  }

  lines.push('', `${'Check'.padEnd(16)}${'Right'.padEnd(10)}Threshold`)
  let above = true
  for (const [name, threshold] of Object.entries(definition.thresholds)) {
    if (!tallies.has(name)) tallies.set(name, { ok: 0, total: 0 })
    const tally = tallies.get(name)!
    if (share(tally) < threshold) above = false
  }
  for (const [name, tally] of tallies) {
    const threshold = definition.thresholds[name]
    const bound = threshold === undefined ? 'none' : `${Math.round(threshold * 100)} %`
    lines.push(`${name.padEnd(16)}${`${tally.ok}/${tally.total}`.padEnd(10)}${bound}`)
  }
  lines.push(
    '',
    `Cases right in all ${RUNS.length} runs: ${passed}/${names.length}`,
    `Verdict: ${above ? 'above the threshold' : 'below the threshold'}`,
    `Cost: $${(meta.cost_usd ?? 0).toFixed(4)}`,
  )
  const text = `${lines.join('\n')}\n`
  writeFileSync(join(dir, 'check.txt'), text)
  console.log(text)
}

function share(tally: Tally): number {
  return tally.total ? tally.ok / tally.total : 1
}
