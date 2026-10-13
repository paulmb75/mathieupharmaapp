import "server-only";
import { storageDir } from "../env";
import { LocalDocumentStorage } from "./local";
import type { DocumentStorage } from "./types";

let instance: DocumentStorage | null = null;

export function getStorage(): DocumentStorage {
  instance ??= new LocalDocumentStorage(storageDir);
  return instance;
}

export function setStorageForTests(storage: DocumentStorage): void {
  instance = storage;
}
