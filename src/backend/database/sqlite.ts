import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { config } from '../config/config.js';
import { memoryService } from '../services/memory.service.js';

let db: Database.Database;

/**
 * Initializes the SQLite database and sets up WAL mode for performance.
 */
export function initDB(): Database.Database {
  if (db) return db;

  db = new Database(config.dbFile);

  // Загружаем sqlite-vec векторную поддержку
  sqliteVec.load(db);

  // WAL (Write-Ahead Logging) is crucial for concurrent performance in SQLite
  db.pragma('journal_mode = WAL');

  console.log('[DB] SQLite connected and ready (with sqlite-vec).');
  memoryService.validateAndMigrate();
  return db;
}

/**
 * Returns the active database instance. 
 * Re-initializes if for some reason it's missing (though it shouldn't be).
 */
export function getDB(): Database.Database {
  if (!db) {
    return initDB();
  }
  return db;
}

/**
 * Checks if the database is initialized with tables and has at least one user.
 */
export function isDatabaseInitialized(): boolean {
  try {
    // We cannot use getDB() if it is not initialized yet, but it's safe because getDB() initializes it.
    const activeDb = getDB();
    const row = activeDb.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
    if (!row || row.count === 0) return false;
    
    const userCount = activeDb.prepare("SELECT count(*) as count FROM users").get() as any;
    return userCount && userCount.count > 0;
  } catch (e) {
    return false;
  }
}


