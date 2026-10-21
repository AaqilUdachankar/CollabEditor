import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nexus_ide',
  jwtSecret: process.env.JWT_SECRET || 'nexus_ide_default_secure_secret_dev_2026',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  storageDir: path.resolve(process.cwd(), process.env.STORAGE_DIR || './data/projects'),
  dbDir: path.resolve(process.cwd(), './data/db'),
  executionTimeoutMs: parseInt(process.env.EXECUTION_TIMEOUT_MS || '15000', 10),
  maxOutputBufferBytes: parseInt(process.env.MAX_OUTPUT_BUFFER_BYTES || '1048576', 10),
};
