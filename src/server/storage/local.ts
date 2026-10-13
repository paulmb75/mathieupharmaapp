import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentStorage } from "./types";

export class LocalDocumentStorage implements DocumentStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private pathFor(key: string): string {
    if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Clé de stockage invalide");
    return path.join(this.root, key.slice(0, 2), key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.pathFor(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, data, { mode: 0o600, flag: "wx" });
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
