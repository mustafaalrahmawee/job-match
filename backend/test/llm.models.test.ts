import { expect, it } from 'vitest';

import { CLAUDE_MODELS, GLM_MODELS, resolveModels } from '../src/llm/models';

it('uses Claude models for the Anthropic API', () => {
  expect(resolveModels('https://api.anthropic.com')).toBe(CLAUDE_MODELS);
  expect(resolveModels('https://api.anthropic.com/')).toBe(CLAUDE_MODELS);
});

it('uses GLM models for any other Anthropic-compatible provider', () => {
  expect(resolveModels('https://api.z.ai/api/anthropic')).toBe(GLM_MODELS);
});
