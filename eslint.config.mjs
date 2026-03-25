import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      complexity: ['warn', 10],
    },
  },
  {
    ignores: ['dist/', 'coverage/', 'node_modules/', 'scripts/'],
  },
);
