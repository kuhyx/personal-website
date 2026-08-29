/**
 * highlight.js ships types for its main entry but not for the per-language
 * subpaths it exports (`./lib/languages/*` in its package exports map), so
 * every `import bash from "highlight.js/lib/languages/bash"` would otherwise
 * be an implicit `any` under `strict`.
 *
 * This declares the shape those modules actually have. It is a missing type
 * definition, not a suppression: the imports stay fully checked against
 * highlight.js's own `LanguageFn`.
 */
declare module "highlight.js/lib/languages/*" {
  import type { LanguageFn } from "highlight.js";
  const language: LanguageFn;
  export default language;
}
