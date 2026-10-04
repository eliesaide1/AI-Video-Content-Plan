import type { Model } from 'mongoose';
import { createLogger } from '../logger.js';
import { registeredModels } from '../../model/index.js';

const log = createLogger('indexes');

/**
 * Applies every index declared on the Mongoose schemas to MongoDB.
 *
 * We keep `autoIndex: false` on the connection and call this once at boot
 * instead. Two reasons:
 *   1. Index creation becomes an explicit, observable startup step (we log it)
 *      rather than an implicit background side effect of the first query.
 *   2. `syncIndexes()` also DROPS indexes that are no longer declared in code,
 *      so the schemas in /model stay the single source of truth for indexing.
 */
export async function syncModelIndexes(): Promise<void> {
  for (const model of registeredModels as Model<unknown>[]) {
    try {
      await model.syncIndexes();
      const indexes = await model.collection.indexes();
      log.info(
        `${model.modelName}: ${indexes.length} index(es) -> ${indexes.map((i) => i.name).join(', ')}`,
      );
    } catch (error) {
      // A failing index must not take the whole API down; it is logged loudly instead.
      log.error(`failed to sync indexes for ${model.modelName}`, error);
    }
  }
}
