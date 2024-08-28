import globals from 'globals'
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import jestPlugin from 'eslint-plugin-jest'

export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  {
    ignores: ['jest.config.js', 'dist/'],
  },
  {
    languageOptions: {
      parser: typescriptParser, // Use TypeScript parser
      globals: {
        NodeJS: true,
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
      jest: jestPlugin,
    },
  },
  {
    rules: {
      ...js.configs.recommended.rules, // Start with the recommended ESLint rules
      ...typescriptEslint.configs.recommended.rules, // Add TypeScript recommended rules
      ...jestPlugin.configs.recommended.rules, // Add Jest recommended rules
      '@typescript-eslint/no-require-imports': 'off', // Something is wrong with this linting set, it's causing a lot of false positives
    },
  },
]