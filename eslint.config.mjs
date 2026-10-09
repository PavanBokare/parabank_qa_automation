import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'reports/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    ...playwright.configs['flat/recommended'],
  },
  {
    files: ['**/*.ts'],
    rules: {
      // TypeScript already covers unused vars with more context; keep as
      // warnings so lint stays actionable without blocking CI.
      '@typescript-eslint/no-unused-vars': 'warn',
      // Existing specs declare async callbacks without explicit return types;
      // requiring them everywhere is a Phase 1 refactor, not Phase 0.
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
);
