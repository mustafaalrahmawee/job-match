import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Gilt für backend/ und shared/. Das Frontend hat eine eigene Konfiguration (Vue-Parser) in
// frontend/eslint.config.ts – ESLint nimmt für jede Datei die nächstgelegene Konfiguration.
export default tseslint.config(
  {
    name: 'job-match/ignores',
    ignores: ['**/dist/**', '**/coverage/**', 'frontend/**', 'backend/drizzle/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    name: 'job-match/typescript',
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Template-Strings mit Zahlen sind in Log- und CLI-Ausgaben gewollt.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `_`-Präfix markiert Parameter, die eine Signatur verlangt (z. B. `_next` der
      // Express-Fehler-Middleware, an der Express die vier Parameter erkennt).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
);
