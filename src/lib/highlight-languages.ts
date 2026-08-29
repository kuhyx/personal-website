/**
 * The languages code fences are highlighted for.
 *
 * `rehype-highlight` defaults to lowlight's "common" set, which pulls roughly
 * forty grammars into the bundle — the landing page was paying 578 kB for
 * syntax highlighting it never uses. Listing the languages explicitly keeps
 * that cost proportional to what actually gets written here.
 *
 * Adding one is a two-line change: import it and add it to the map. Anything
 * unlisted still renders as a plain, correctly styled code block.
 */

import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import dart from "highlight.js/lib/languages/dart";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/** Grammar map in the shape `rehype-highlight` expects. */
export const highlightLanguages = {
  bash,
  c,
  cpp,
  css,
  dart,
  diff,
  go,
  ini,
  javascript,
  json,
  python,
  rust,
  sql,
  typescript,
  xml,
  yaml,
};
