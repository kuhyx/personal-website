/**
 * Substituting a rendered page into the built `index.html`.
 *
 * Lives in `src/` rather than in `scripts/prerender.mjs` because it is logic,
 * not I/O, and `scripts/` sits outside both `tsconfig.json`'s `include` and
 * `pnpm lint`'s `eslint src` — build-critical code with no gate on it.
 */

const HEAD_START = "<!--head-start-->";
const HEAD_END = "<!--head-end-->";
const APP_MARKER = "<!--app-html-->";

/**
 * Replace `marker` with `value` literally.
 *
 * `String.replace` honours `$&`, `` $` ``, `$'` and `$n` in the *replacement*
 * argument, and React escapes `'`, `"`, `&`, `<` and `>` into entities — so a
 * post containing `$'` (ANSI-C quoting, ordinary in a shell snippet) renders
 * as `$&#39;` and would splice a copy of the surrounding document into the
 * page. A replacer function receives the value verbatim instead.
 */
function replaceLiteral(source: string, marker: string, value: string): string {
  return source.replace(marker, () => value);
}

/** Put one rendered route into the HTML template. */
export function inject(
  template: string,
  page: { readonly html: string; readonly head: string },
): string {
  const headStart = template.indexOf(HEAD_START);
  const headEnd = template.indexOf(HEAD_END);
  if (headStart === -1 || headEnd === -1) {
    throw new Error(`index.html is missing ${HEAD_START} / ${HEAD_END}`);
  }
  if (!template.includes(APP_MARKER)) {
    throw new Error(`index.html is missing ${APP_MARKER}`);
  }
  const withHead =
    template.slice(0, headStart + HEAD_START.length) +
    `\n    ${page.head}\n    ` +
    template.slice(headEnd);
  return replaceLiteral(withHead, APP_MARKER, page.html);
}

/** `/` -> `index.html`; `/blog/x` -> `blog/x/index.html`. Always relative. */
export function outputPath(route: string): string {
  return route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
}
