/**
 * Executable entry point for the admin service.
 *
 * Exists so that `src/admin/server/index.ts` runs nothing on import and can be
 * tested like any other module -- the same reason `prerender.mjs` sits here
 * rather than in `src/`. Bundled by `pnpm build:admin`; not run from source.
 */

import { main } from "../src/admin/server/index";

await main(process.argv.slice(2));
