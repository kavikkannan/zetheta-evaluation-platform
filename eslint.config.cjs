const base = require("@zetheta/shared-config/eslint/base");

module.exports = [
  {
    ignores: ["**/dist/**", "**/.next/**", "node_modules/**"],
  },
  {
    ...base,
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.cjs", "**/*.mjs"],
  },
];
