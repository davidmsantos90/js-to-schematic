module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { sourceType: "module", ecmaVersion: "latest", project: false },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  ignorePatterns: ["dist", "dist-ts", "node_modules", "src/test/**", "code-files/**"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "no-constant-condition": ["error", { checkLoops: false }],
    "@typescript-eslint/no-explicit-any": "off",
  },
};
