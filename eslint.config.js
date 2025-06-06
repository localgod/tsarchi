import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import stylisticTs from '@stylistic/eslint-plugin'
import parserTs from '@typescript-eslint/parser'


export default [
  {
    files: ["**/*.{js,mjs,mts}"],

  },
  { languageOptions: { globals: globals.browser, parser: parserTs } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parser: parserTs,
      parserOptions: {
        sourceType: "module",
      }
    }
  },
  {
    plugins: {
      '@stylistic/ts': stylisticTs
    },
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off",
      '@stylistic/ts/indent': ['error', 2],
    }
  }
];
