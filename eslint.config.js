const { defineConfig } = require("eslint/config");
const globals = require("globals");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [".expo/**", "android/**", "ios/**", "dist/**", "coverage/**", "release/**"],
  },
  {
    files: ["desktop/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
]);
