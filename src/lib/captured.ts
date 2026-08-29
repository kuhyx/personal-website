/**
 * Read a capture group from a regex match.
 *
 * `noUncheckedIndexedAccess` types every array index as possibly-absent, so
 * `match[1]` is `string | undefined` even when the pattern makes group 1
 * mandatory. Written inline at each call site that produces an `?? ""` branch
 * no test can ever reach; funnelling them through one tested helper keeps the
 * call sites branchless and the fallback honestly exercised.
 */
export function captured(match: RegExpMatchArray, index: number): string {
  return match[index] ?? "";
}
