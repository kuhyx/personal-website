/**
 * The first item of a list, failing loudly when there is none.
 *
 * Tests need `posts[0]` narrowed to a value, and `noUncheckedIndexedAccess`
 * types it as possibly-absent. Both ways out of that are banned here — a
 * `as Post` cast trips `non-nullable-type-assertion-style`, and the `!` it
 * suggests trips `no-non-null-assertion` — so the honest option is a check
 * that turns an empty corpus into a clear failure instead of `undefined is
 * not an object` fifteen lines later.
 */
export function first<T>(items: readonly T[], what: string): T {
  const [item] = items;
  if (item === undefined) {
    throw new Error(`expected at least one ${what}`);
  }
  return item;
}
