import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

let isMongoConnected = false;

export async function initDatabase(): Promise<boolean> {
  // Ensure data directories exist
  if (!fs.existsSync(config.storageDir)) {
    fs.mkdirSync(config.storageDir, { recursive: true });
  }
  if (!fs.existsSync(config.dbDir)) {
    fs.mkdirSync(config.dbDir, { recursive: true });
  }

  try {
    // Attempt Mongoose connection with 2.5 second timeout
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500,
    });
    isMongoConnected = true;
    console.log(`[Database] Successfully connected to MongoDB at ${config.mongodbUri}`);
    return true;
  } catch (err: any) {
    isMongoConnected = false;
    console.warn(`[Database] MongoDB not reachable (${err.message}). Using persistent local JSON document store at ${config.dbDir}.`);
    return false;
  }
}

export function isMongoActive(): boolean {
  return isMongoConnected && mongoose.connection.readyState === 1;
}
