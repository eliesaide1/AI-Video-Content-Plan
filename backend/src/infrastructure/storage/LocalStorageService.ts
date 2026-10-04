import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/AppError.js';
import { createLogger } from '../logger.js';
import type { SavedFile, StorageService } from './StorageService.js';

const log = createLogger('storage');

export class LocalStorageService implements StorageService {
  constructor(private readonly root: string) {}

  async save(relativePath: string, content: string): Promise<SavedFile> {
    const absolute = this.toAbsolute(relativePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
    const bytes = Buffer.byteLength(content, 'utf8');
    log.info(`saved ${relativePath} (${bytes} bytes)`);
    return { path: relativePath, bytes, savedAt: new Date() };
  }

  async read(relativePath: string): Promise<string> {
    const absolute = this.toAbsolute(relativePath);
    try {
      return await fs.readFile(absolute, 'utf8');
    } catch {
      throw AppError.notFound(`File not found: ${relativePath}`);
    }
  }

  async delete(relativePath: string): Promise<void> {
    await fs.rm(this.toAbsolute(relativePath), { force: true });
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.toAbsolute(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async list(relativeDir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.toAbsolute(relativeDir), { withFileTypes: true });
      return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
    } catch {
      return [];
    }
  }

  resolveUri(relativePath: string): string {
    return this.toAbsolute(relativePath);
  }

  /**
   * Security: generated file names come (indirectly) from AI output and user
   * input, so every path is normalised and verified to stay inside the storage
   * root. `../` escapes are rejected, not silently clamped.
   */
  private toAbsolute(relativePath: string): string {
    if (!relativePath || typeof relativePath !== 'string') {
      throw AppError.badRequest('A storage path is required');
    }
    if (relativePath.includes('\0')) {
      throw AppError.badRequest('Invalid storage path');
    }
    const normalised = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolute = path.resolve(this.root, normalised);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (absolute !== this.root && !absolute.startsWith(rootWithSep)) {
      throw AppError.badRequest(`Path escapes the storage root: ${relativePath}`);
    }
    return absolute;
  }
}
