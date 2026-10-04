/**
 * Storage abstraction.
 *
 * V1 writes everything to the local disk (LocalStorageService). Phase 7 can add
 * a CloudStorageService behind this same interface without touching any
 * business logic in /application.
 *
 * All paths are RELATIVE to the storage root, e.g.
 *   courses/<course-id>/research/MASTER.md
 */
export interface StorageService {
  save(relativePath: string, content: string): Promise<SavedFile>;
  read(relativePath: string): Promise<string>;
  delete(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
  list(relativeDir: string): Promise<string[]>;
  resolveUri(relativePath: string): string;
}

export interface SavedFile {
  path: string;
  bytes: number;
  savedAt: Date;
}
