import type { ModelChoice } from '@job-match/shared';

export type ModelMap = Readonly<Record<ModelChoice, string>>;

const ANTHROPIC_HOST = 'api.anthropic.com';

export const CLAUDE_MODELS: ModelMap = {
  standard: 'claude-sonnet-5-5',
  advanced: 'claude-opus-5-5',
};

export const GLM_MODELS: ModelMap = {
  standard: 'glm-5.3-flash',
  advanced: 'glm-5.3',
};

export function resolveModels(baseUrl: string): ModelMap {
  return new URL(baseUrl).host === ANTHROPIC_HOST ? CLAUDE_MODELS : GLM_MODELS;
}
