import js from "@eslint/js"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import prettier from "eslint-config-prettier"
import globals from "globals"

export default tseslint.config(
  { ignores: ["**/dist"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "id-length": ["warn", { min: 2, exceptions: ["e", "i", "j", "x", "y", "_"] }],
    },
  },
  // Stänger av regler som krockar med Prettier. Måste ligga sist.
  prettier,
)
