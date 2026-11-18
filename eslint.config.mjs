import { defineConfig, globalIgnores } from "eslint/config";
import css from "@eslint/css";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Every colour has one home, theme/theme.ts. Other code imports it, and the style files use its CSS variables.
const useTheme = "Use a colour from theme/theme.ts.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["theme/theme.ts"],
    rules: {
      "no-restricted-syntax": ["error",
        { selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]", message: useTheme },
        { selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]", message: useTheme },
        { selector: "Literal[raw=/^0x[0-9a-fA-F]{6}$/]", message: useTheme },
      ],
    },
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    rules: {
      "no-restricted-syntax": ["error",
        { selector: "Hash", message: useTheme },
        { selector: "Function[name=/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch)$/]", message: useTheme },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "worker/.wrangler/**",
  ]),
]);

export default eslintConfig;
