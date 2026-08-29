/**
 * An in-memory {@link FileSystemPort}, used by the tests and by nothing else.
 *
 * Lives in `src/` rather than a test file so both the store tests and the
 * handler tests share one implementation: two hand-rolled fakes that drift is
 * how a suite starts passing against behaviour the real filesystem does not
 * have.
 */

import { dirname } from "node:path";
import type { FileSystemPort } from "./store";

/** A fake filesystem backed by a flat path -> contents map. */
export class MemoryFs implements FileSystemPort {
  readonly files = new Map<string, Uint8Array>();
  readonly directories = new Set<string>();

  constructor(initial: Readonly<Record<string, string>> = {}) {
    for (const [path, contents] of Object.entries(initial)) {
      this.files.set(path, new TextEncoder().encode(contents));
      this.#addParents(path);
    }
  }

  #addParents(path: string): void {
    let parent = dirname(path);
    while (parent !== "/" && parent !== "." && !this.directories.has(parent)) {
      this.directories.add(parent);
      parent = dirname(parent);
    }
  }

  readText(path: string): Promise<string> {
    const bytes = this.files.get(path);
    if (bytes === undefined) {
      return Promise.reject(new Error(`ENOENT: ${path}`));
    }
    return Promise.resolve(new TextDecoder().decode(bytes));
  }

  readBytes(path: string): Promise<Uint8Array> {
    const bytes = this.files.get(path);
    return bytes === undefined
      ? Promise.reject(new Error(`ENOENT: ${path}`))
      : Promise.resolve(bytes);
  }

  writeText(path: string, data: string): Promise<void> {
    return this.writeBytes(path, new TextEncoder().encode(data));
  }

  writeBytes(path: string, data: Uint8Array): Promise<void> {
    this.files.set(path, data);
    this.#addParents(path);
    return Promise.resolve();
  }

  mkdirp(path: string): Promise<void> {
    this.directories.add(path);
    this.#addParents(`${path}/x`);
    return Promise.resolve();
  }

  listDir(path: string): Promise<string[]> {
    const prefix = `${path}/`;
    const names = new Set<string>();
    for (const candidate of [...this.files.keys(), ...this.directories]) {
      if (!candidate.startsWith(prefix)) {
        continue;
      }
      const rest = candidate.slice(prefix.length);
      const slash = rest.indexOf("/");
      names.add(slash === -1 ? rest : rest.slice(0, slash));
    }
    return Promise.resolve([...names].sort());
  }

  removeDir(path: string): Promise<void> {
    const prefix = `${path}/`;
    for (const candidate of [...this.files.keys()]) {
      if (candidate.startsWith(prefix)) {
        this.files.delete(candidate);
      }
    }
    for (const candidate of [...this.directories]) {
      if (candidate === path || candidate.startsWith(prefix)) {
        this.directories.delete(candidate);
      }
    }
    return Promise.resolve();
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path) || this.directories.has(path));
  }
}
