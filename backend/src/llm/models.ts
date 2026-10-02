/**
 * Modell-Zuordnung je Anbieter. Die App kennt nur zwei Stufen – „Normal“ und „Erweitert“. Welche
 * Modell-ID dahinter steckt, hängt am Anbieter aus `ANTHROPIC_BASE_URL`; ein Wechsel ist damit nur
 * eine .env-Änderung.
 */

/** Was der Nutzer wählen kann (Stufe 1 zeigt es im Chat als „Normal“/„Erweitert“). */
export type ModelChoice = 'standard' | 'advanced';

/** Die API kennt fünf Stufen; die App zeigt nur zwei, damit die Wahl verständlich bleibt. */
export type Effort = 'low' | 'high';

export type ModelMap = Readonly<Record<ModelChoice, string>>;

export const ANTHROPIC_HOST = 'api.anthropic.com';

/** Claude: „Normal“ = Sonnet 5.5 (schnell, günstig), „Erweitert“ = Opus 5.5 (komplexe Aufgaben). */
export const CLAUDE_MODELS: ModelMap = {
  standard: 'claude-sonnet-5-5',
  advanced: 'claude-opus-5-5',
};

/**
 * Entwicklung über z.ai (`https://api.z.ai/api/anthropic`), solange die Claude API nicht bezahlt
 * wird. Die App wird trotzdem für Claude gebaut (docs/STUFEN.md §1).
 */
export const GLM_MODELS: ModelMap = {
  standard: 'glm-5.3-flash',
  advanced: 'glm-5.3',
};

/** Modell-IDs des Anbieters, erkannt am Host der Base-URL. */
export function resolveModels(baseUrl: string): ModelMap {
  return new URL(baseUrl).host === ANTHROPIC_HOST ? CLAUDE_MODELS : GLM_MODELS;
}
