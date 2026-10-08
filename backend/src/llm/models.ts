import type { ModelChoice } from '@job-match/shared';

export type ModelMap = Readonly<Record<ModelChoice, string>>;

const ANTHROPIC_HOST = 'api.anthropic.com';

export const ZAI_BASE_URL = 'https://api.z.ai/api/anthropic';

export const CLAUDE_MODELS: ModelMap = {
  standard: 'claude-haiku-5-5',
  advanced: 'claude-haiku-5-5',
};

export const GLM_MODELS: ModelMap = {
  standard: 'glm-5.3-flash',
  advanced: 'glm-5.3',
};

export const PRICES_USD_PER_MILLION: Readonly<
  Record<string, { readonly input: number; readonly output: number }>
> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'glm-5.3-flash': { input: 0.15, output: 0.5 },
  'glm-5.3': { input: 1.4, output: 4.4 },
};

export function resolveModels(baseUrl: string): ModelMap {
  return new URL(baseUrl).host === ANTHROPIC_HOST ? CLAUDE_MODELS : GLM_MODELS;
}
