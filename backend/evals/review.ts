import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../src/config/env.js'

const EVALS = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(EVALS, '..', '..')
const PLAN = join(ROOT, 'docs', 'EVAL_PLAN.md')
const MAX_ROUNDS = 3
const CORPUS: Record<string, string> = {
  cv_analysis: 'corpus/cvs',
  job_extract: 'corpus/ads',
  match_analysis: 'corpus/cvs',
}
const TEXT_FILES = new Set(['.json', '.html', '.md', '.txt'])
const IMAGE_FILES = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export function review(unit: string, cases: string[], allCases: boolean): void {
  const reviewPath = join(EVALS, unit, 'review.md')
  if (!existsSync(reviewPath)) fail(`${reviewPath} is missing`)

  const samples = join(EVALS, unit, 'samples')
  const existing = existsSync(samples) ? directories(samples) : []
  const reviewText = readFileSync(reviewPath, 'utf8')

  if (allCases) {
    const files = [fileTag(PLAN), ...existing.map((c) => textFiles(join(samples, c)))].join('\n\n')
    const answer = ask(systemPrompt(unit, reviewText, 'About all cases', false), files)
    append(reviewPath, 'About all cases', answer)
    console.log(answer)
    return
  }

  const selected = cases.length ? cases : existing.filter((c) => rounds(reviewText, c) === 0)
  const corpusDir = join(EVALS, CORPUS[unit] ?? '')

  const rows: [string, string, string][] = []
  for (const name of selected) {
    if (!existing.includes(name)) {
      rows.push([name, '-', 'not found'])
      continue
    }
    const round = rounds(readFileSync(reviewPath, 'utf8'), name) + 1
    if (round > MAX_ROUNDS) {
      rows.push([name, '-', 'limit reached'])
      continue
    }
    console.log(`Reviewing ${name}, round ${round} ...`)
    const answer = ask(
      systemPrompt(unit, reviewText, 'Questions', true),
      `${corpus(corpusDir, name)}Case: ${name}\n\n${textFiles(join(samples, name))}`,
      [join(corpusDir, name), join(samples, name)].filter((d) => existsSync(d)).flatMap(mediaFiles),
    )
    append(reviewPath, `${name} (round ${round})`, answer)
    rows.push([name, String(round), verdict(answer)])
  }

  console.log(`\n${'Case'.padEnd(32)}${'Round'.padEnd(8)}Verdict`)
  for (const [name, round, result] of rows) {
    console.log(`${name.padEnd(32)}${round.padEnd(8)}${result}`)
  }
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

/**
 * Prompt unit review: analytic report, single call.
 * Profile: text, medium abstraction, context from review.md and the case files, stateless.
 * Surface: lines appended to review.md, verdict word read by verdict(). Urgency: low (nobody waits).
 * Model: Codex (codex exec, read-only), EVAL_JUDGE_MODEL at EVAL_JUDGE_EFFORT (gpt-6.1-sol, high).
 * Slots: unit and today (boilerplate), rules and questions (static per unit, from review.md),
 * case files and corpus (direct, user turn).
 * Stop: one line per question, codex exits 0 with a final message. Enforced in code: verdict parsed from the
 * F10 line, unreadable verdict counts as unclear, at most three rounds per case.
 */
function systemPrompt(
  unit: string,
  reviewText: string,
  questionsSection: string,
  withVerdict: boolean,
): string {
  const verdictRule = withVerdict
    ? ' The F10 line starts with "F10:" followed by exactly one of the words keep, change or remove, because the review command reads the verdict from that word.'
    : ''
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  })
  return `This is the review log of the ${unit} test collection for an AI feature: another model wrote each made-up case and its gold solution (gold.json), and an independent reviewer checks whether the case is fair, whether the gold solution is right and whether the case reads as real.

Today is ${today}.

For each finding the reviewer names where in the files it is visible, so that every line can be checked again. The reviewer writes in English, one line per question starting with its number (e.g. "F1: ..."), with no introduction and no closing words, because the lines are appended to the log as they are.${verdictRule}

Rules of the test collection:
${section(reviewText, 'Rules')}

Questions:
${section(reviewText, questionsSection)}`
}

function ask(system: string, content: string, media: string[] = []): string {
  const model = env.EVAL_JUDGE_MODEL
  const dir = mkdtempSync(join(tmpdir(), 'evals-review-'))
  const answerPath = join(dir, 'answer.md')
  const images = media.filter((path) => IMAGE_FILES.has(extname(path)))
  const pdfs = media.filter((path) => extname(path) === '.pdf').map((path) => relative(ROOT, path))
  const args = ['exec', '-', '--sandbox', 'read-only', '--ephemeral', '--skip-git-repo-check']
  args.push('-C', ROOT, '-o', answerPath, '-c', `model_reasoning_effort=${env.EVAL_JUDGE_EFFORT}`)
  if (model) args.push('-m', model)
  if (images.length) args.push('-i', images.join(','))
  const pdfNote = pdfs.length ? `\n\nRead these PDF files of the case yourself: ${pdfs.join(', ')}` : ''
  const result = spawnSync('codex', args, {
    input: `${system}\n\n${content}${pdfNote}`,
    encoding: 'utf8',
    timeout: 1_200_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  const text = existsSync(answerPath) ? readFileSync(answerPath, 'utf8') : ''
  rmSync(dir, { recursive: true, force: true })
  if (result.status !== 0 || !text.trim()) {
    fail(
      `codex ended with ${result.error?.message ?? `status ${result.status}`}; nothing written\n${result.stderr.slice(-2000)}`,
    )
  }
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.startsWith('- ') ? line : `- ${line}`))
  return `${lines.join('\n')}\n\n(codex ${model || 'default'}, effort ${env.EVAL_JUDGE_EFFORT})`
}

function corpus(corpusDir: string, name: string): string {
  const own = join(corpusDir, name)
  if (existsSync(own)) return `${textFiles(own)}\n\n`
  if (existsSync(corpusDir)) return `${textFiles(corpusDir)}\n\n`
  return ''
}

function mediaFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => extname(path) === '.pdf' || IMAGE_FILES.has(extname(path)))
    .sort()
}

function directories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function textFiles(directory: string): string {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && TEXT_FILES.has(extname(entry.name)))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
  return files.map(fileTag).join('\n\n')
}

function fileTag(path: string): string {
  const inside = !relative(EVALS, path).startsWith('..')
  const name = relative(inside ? EVALS : ROOT, path)
  return `<file name="${name}">\n${readFileSync(path, 'utf8')}\n</file>`
}

function section(reviewText: string, title: string): string {
  const marker = `## ${title}\n`
  const start = reviewText.indexOf(marker)
  if (start < 0) return ''
  const rest = reviewText.slice(start + marker.length)
  const end = rest.indexOf('\n## ')
  return (end < 0 ? rest : rest.slice(0, end)).trim()
}

function rounds(reviewText: string, name: string): number {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return reviewText.match(new RegExp(`^### ${escaped} \\(round \\d+\\)$`, 'gm'))?.length ?? 0
}

function verdict(answer: string): string {
  const line = /F10[^\n]*/.exec(answer)
  const word = line ? /\b(keep|change|remove)\b/i.exec(line[0]) : null
  return word ? word[1].toLowerCase() : 'unclear'
}

function append(reviewPath: string, heading: string, answer: string): void {
  appendFileSync(reviewPath, `\n### ${heading}\n\n${answer}\n`)
}
