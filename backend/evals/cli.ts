import { parseArgs } from 'node:util'
import { z } from 'zod'
import { check } from './check.js'
import { review } from './review.js'
import { run } from './run.js'

const usage = `usage:
  pnpm evals review <unit> [cases...] [--all]
  pnpm evals run <unit> <fassung> [model] [effort] [--yes]
  pnpm evals check <unit> <fassung>`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
  },
})
const [command, unit, ...rest] = positionals

if (!unit) {
  console.error(usage)
  process.exit(2)
}

if (command === 'review') {
  await review(unit, rest, values.all)
} else if (command === 'run' && rest[0]) {
  const [fassung, model, effort] = rest
  await run(
    unit,
    fassung,
    { model, effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional().parse(effort) },
    values.yes,
  )
} else if (command === 'check' && rest[0]) {
  check(unit, rest[0])
} else {
  console.error(usage)
  process.exit(2)
}
