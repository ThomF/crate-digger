import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// Linting catches bugs; Prettier owns formatting (skipFormatting turns off style rules).
export default defineConfigWithVueTs(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,
)
