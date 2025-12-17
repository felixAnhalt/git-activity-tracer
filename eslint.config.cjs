// Flat ESLint config (ESLint v8+ migration)
// See: https://eslint.org/docs/latest/use/configure/migration-guide
module.exports = [
  // Ignore build and deps
  {
    ignores: ["dist/**", "node_modules/**"],
  },

  // Base config for TypeScript files
  {
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "no-console": "off",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },

  // TS-specific overrides (files matcher ensures these apply to .ts files)
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    rules: {},
  },
];
