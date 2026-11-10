// `.astro` imports for plain `tsc`, which does not know the format; the Astro
// language server (`astro check`) types them precisely. Only tests import them.
declare module "*.astro" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";

  const component: AstroComponentFactory;
  export default component;
}
