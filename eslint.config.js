import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-admin", "coverage", ".astro"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  ...astro.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
  // Plain JS and the .astro shells get no type-aware linting: astro-eslint-parser
  // types every JSX expression as an error type, so the no-unsafe-* rules would
  // fire on each `.map(...)`. `astro check` (in `pnpm lint` and `pnpm build`)
  // typechecks the shells instead, and their logic lives in tested src/lib/*.ts.
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs", "**/*.astro"],
    ...tseslint.configs.disableTypeChecked,
  },
);
