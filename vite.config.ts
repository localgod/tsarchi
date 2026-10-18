import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: ['src/index.mts', 'src/internal/relationships-matrix.mts'],
    overrides: [
      {
        files: ['*.mts', '*.ts', '*.mjs', '*.js'],
        options: {
          singleQuote: true,
          trailingComma: 'es5',
          printWidth: 140,
          arrowParens: 'avoid',
        },
      },
    ],
  },
  lint: {
    overrides: [
      {
        files: ['src/**'],
        rules: {
          'no-console': 'error',
          'no-restricted-globals': [
            'error',
            {
              name: 'structuredClone',
              message: 'QuickJS has no structuredClone; use deepCopy from src/internal/Copy.mts.',
            },
          ],
        },
      },
    ],
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
  },
});
