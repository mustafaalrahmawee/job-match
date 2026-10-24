import { expect, test } from 'vitest'
import { assemble, estimateTokens, type PromptElement } from '../../src/llm/assemble.js'

const chars = (text: string) => text.length

const frame: PromptElement = { id: 'frame', position: 0, tier: 3, versions: ['FRAME'] }
const contract: PromptElement = { id: 'contract', position: 9, tier: 3, versions: ['CONTRACT'] }

test('everything that fits is kept in position order', () => {
  const { texts, dropped, tokens } = assemble([contract, frame], 100, chars)
  expect([...texts.keys()]).toEqual(['frame', 'contract'])
  expect(dropped).toEqual([])
  expect(tokens).toBe(13)
})

test('an elastic element shrinks to the largest version that fits', () => {
  const passage: PromptElement = { id: 'passage', position: 1, tier: 1, versions: ['long version', 'medium', 'sh'] }
  expect(assemble([frame, passage, contract], 20, chars).texts.get('passage')).toBe('medium')
  expect(assemble([frame, passage, contract], 15, chars).texts.get('passage')).toBe('sh')
  expect(assemble([frame, passage, contract], 13, chars).dropped).toEqual(['passage'])
})

test('the lowest tier goes first, the earliest position inside it, the top tier never', () => {
  const elements: PromptElement[] = [
    frame,
    { id: 'turn-1', position: 1, tier: 1, versions: ['oldest turn'] },
    { id: 'turn-2', position: 2, tier: 1, versions: ['newer turn'] },
    { id: 'hint', position: 3, tier: 2, versions: ['a hint'] },
    contract,
  ]
  expect(assemble(elements, 100, chars).dropped).toEqual([])
  expect(assemble(elements, 30, chars).dropped).toEqual(['turn-1'])
  expect(assemble(elements, 20, chars).dropped).toEqual(['turn-1', 'turn-2'])
  expect(assemble(elements, 13, chars).dropped).toEqual(['turn-1', 'turn-2', 'hint'])
  expect(() => assemble(elements, 12, chars)).toThrow('Prompt over budget: 13 of 12')
})

test('a lower score is cut before an earlier position', () => {
  const elements: PromptElement[] = [
    frame,
    { id: 'weak', position: 2, tier: 1, score: 0.2, versions: ['weak'] },
    { id: 'strong', position: 1, tier: 1, score: 0.9, versions: ['strong'] },
  ]
  expect(assemble(elements, 12, chars).dropped).toEqual(['weak'])
})

test('dropping an element drops what requires it, and a missing requirement drops at once', () => {
  const elements: PromptElement[] = [
    frame,
    { id: 'character', position: 1, tier: 1, versions: ['Richard'] },
    { id: 'relation', position: 2, tier: 2, versions: ['Jed'], requires: ['character'] },
    { id: 'orphan', position: 3, tier: 2, versions: ['x'], requires: ['missing'] },
  ]
  expect(assemble(elements, 100, chars).dropped).toEqual(['orphan'])
  expect(assemble(elements, 7, chars).dropped).toEqual(['orphan', 'character', 'relation'])
})

test('tokens are estimated from characters by default', () => {
  expect(estimateTokens('abcdefg')).toBe(3)
  expect(assemble([frame], 100).tokens).toBe(2)
})
