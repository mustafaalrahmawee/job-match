export type Tier = 1 | 2 | 3

export type PromptElement = {
  id: string
  position: number
  tier: Tier
  score?: number
  versions: string[]
  requires?: string[]
}

export type Assembly = { texts: Map<string, string>; dropped: string[]; tokens: number }

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3)
}

export function assemble(elements: PromptElement[], budget: number, measure = estimateTokens): Assembly {
  const chosen = new Map(elements.map((element) => [element.id, 0]))
  const dropped: string[] = []
  const drop = (id: string) => {
    if (!chosen.delete(id)) return
    dropped.push(id)
    for (const element of elements) if (element.requires?.includes(id)) drop(element.id)
  }
  for (const element of elements) if (element.requires?.some((id) => !chosen.has(id))) drop(element.id)
  const total = () =>
    elements.reduce((sum, element) => {
      const index = chosen.get(element.id)
      return index === undefined ? sum : sum + measure(element.versions[index])
    }, 0)
  const next = () =>
    elements
      .filter((element) => chosen.has(element.id) && element.tier < 3)
      .sort((a, b) => a.tier - b.tier || (a.score ?? 0) - (b.score ?? 0) || a.position - b.position)[0]
  let tokens = total()
  while (tokens > budget) {
    const victim = next()
    if (!victim) throw new Error(`Prompt over budget: ${tokens} of ${budget} tokens in elements that cannot be cut`)
    const index = chosen.get(victim.id)! + 1
    if (index < victim.versions.length) chosen.set(victim.id, index)
    else drop(victim.id)
    tokens = total()
  }
  const texts = new Map(
    elements
      .filter((element) => chosen.has(element.id))
      .sort((a, b) => a.position - b.position)
      .map((element) => [element.id, element.versions[chosen.get(element.id)!]]),
  )
  return { texts, dropped, tokens }
}
