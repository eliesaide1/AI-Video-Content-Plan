import mongoose from 'mongoose';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('database');

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<typeof mongoose> {
  log.info(`connecting to MongoDB: ${maskUri(config.mongoUri)}`);

  mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));
  mongoose.connection.on('error', (error) => log.error('MongoDB connection error', error));

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: false, // indexes are applied explicitly by syncModelIndexes()
  });

  log.info(`connected to database "${mongoose.connection.name}"`);
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  log.info('MongoDB connection closed');
}

function maskUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@]+)@/, '//$1:****@');
}
