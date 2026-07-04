import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

// Flat config (ESLint 9+). Replaces the old .eslintrc.json.
export default tseslint.config(
  {
    // Global ignores. Mirrors the old ignorePatterns; node_modules is
    // ignored by default but listed for clarity. `out`/`dist` are the
    // Vite/electron-builder output dirs; `build` is the legacy webpack one.
    ignores: [
      'node_modules/',
      'out/',
      'dist/',
      'build/',
      '**/__tests__/',
      '**/*.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'indent': ['warn', 2, { SwitchCase: 1 }],
      'eqeqeq': 'off',
      'prefer-const': 'off',
      'no-case-declarations': 'off',
      'space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'ignore',
      }],
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // `ban-types` was removed in typescript-eslint 8 and split into the
      // rules below. The old config disabled `ban-types` wholesale, so keep
      // its successors off to preserve the previous lint surface.
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
    },
  },
)
