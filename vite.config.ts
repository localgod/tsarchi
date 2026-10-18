import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    // Generated files, and files outside the paths `npm run format` checks (formatting package.json would re-sort its keys).
    ignorePatterns: [
      'src/index.mts',
      'src/internal/relationships-matrix.mts',
      '.claude/**',
      '.devcontainer/**',
      '.github/**',
      '.vscode/**',
      'package.json',
      'tsconfig.json',
    ],
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
      // XML values are typed `unknown` (fast-xml-parser may return numbers or booleans) and are stringified on purpose.
      'typescript/no-base-to-string': 'off',
      // Errors for unknown types print the rejected value, which a failed type guard narrows to `never`.
      'typescript/restrict-template-expressions': 'off',
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
