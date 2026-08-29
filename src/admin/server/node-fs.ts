/**
 * The real {@link FileSystemPort}, on `node:fs/promises`.
 *
 * Deliberately thin: every path it receives was already built and validated by
 * `store.ts`, so this file adds no logic of its own -- it exists only so that
 * the rest of the service can be exercised against {@link MemoryFs} instead.
 */

import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import type { FileSystemPort } from "./store";

/** Disk-backed filesystem access for the store. */
export class NodeFs implements FileSystemPort {
  async readText(path: string): Promise<string> {
    return readFile(path, "utf8");
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(path));
  }

  async writeText(path: string, data: string): Promise<void> {
    await writeFile(path, data, "utf8");
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    await writeFile(path, data);
  }

  async mkdirp(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async listDir(path: string): Promise<string[]> {
    return readdir(path);
  }

  async removeDir(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
