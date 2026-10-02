import js from '@eslint/js';
import prettier from '@vue/eslint-config-prettier';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';

export default defineConfigWithVueTs(
  {
    name: 'job-match/ignores',
    // Fremder Code: die shadcn-vue-Komponenten werden per CLI kopiert.
    ignores: ['dist/**', 'coverage/**', 'src/components/ui/**'],
  },
  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.strict,
  prettier,
);
