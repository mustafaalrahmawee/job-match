import { parseArgs } from 'node:util'
import { review } from './review.js'

const usage = 'usage: pnpm evals review <unit> [cases...] [--all]'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { all: { type: 'boolean', default: false } },
})
const [command, unit, ...cases] = positionals

if (command !== 'review' || !unit) {
  console.error(usage)
  process.exit(2)
}

await review(unit, cases, values.all)
