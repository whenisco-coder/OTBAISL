/**
 * Web Worker that owns the SQLite connection (Layer 1: Persistence)
 * Runs off the main thread so the UI never freezes.
 * Uses wa-sqlite with OPFS (Origin Private File System) and resilient IDB fallback.
 */

// @ts-ignore
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite';
// @ts-ignore
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js';
// @ts-ignore
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js';
// @ts-ignore
import { MemoryAsyncVFS } from 'wa-sqlite/src/examples/MemoryAsyncVFS.js';
import wasmUrl from 'wa-sqlite/dist/wa-sqlite-async.wasm?url';

interface WorkerRequest {
  id: string;
  type: 'init' | 'query' | 'execute' | 'exec' | 'close';
  sql?: string;
  params?: any[];
}

interface WorkerResponse {
  id: string;
  result?: any;
  error?: string;
}

let sqlite3: any = null;
let db: number | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Sanitizes parameters for SQLite binding.
 * Converts booleans to integers and undefined to null.
 */
function sanitizeParam(val: any): any {
  if (val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val;
}

/**
 * Binds an array of parameters (1-indexed in SQLite).
 */
function bindParams(sqlite: any, stmt: number, params: any[]) {
  for (let i = 0; i < params.length; i++) {
    const val = sanitizeParam(params[i]);
    sqlite.bind(stmt, i + 1, val);
  }
}

/**
 * Initializes wa-sqlite with OPFS or fallback VFS and opens tyrebuddy.sqlite.
 */
async function initDatabase(): Promise<void> {
  if (isInitialized && db !== null) return;

  const module = await SQLiteAsyncESMFactory({
    locateFile: () => wasmUrl,
  });

  sqlite3 = SQLite.Factory(module);

  let vfs: any = null;
  let chosenVfs = 'opfs';

  // Check if OPFS is supported in this Worker context
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.getDirectory === 'function'
  ) {
    try {
      vfs = new OriginPrivateFileSystemVFS();
      chosenVfs = 'opfs';
    } catch (opfsErr) {
      console.warn('[SQLite Worker] OPFS instantiation failed:', opfsErr);
    }
  }

  // Graceful fallback to IDB batch atomic VFS
  if (!vfs) {
    try {
      vfs = new IDBBatchAtomicVFS('tyrebuddy_idb_vfs');
      chosenVfs = 'idb-batch-atomic';
    } catch (idbErr) {
      console.warn('[SQLite Worker] IDB VFS instantiation failed:', idbErr);
      vfs = new MemoryAsyncVFS();
      chosenVfs = 'memory-async';
    }
  }

  try {
    sqlite3.vfs_register(vfs, true);
    db = await sqlite3.open_v2('tyrebuddy.sqlite');
  } catch (openErr) {
    // If OPFS open failed, fall back to IDB
    if (chosenVfs === 'opfs') {
      console.warn('[SQLite Worker] Failed to open with OPFS, falling back to IDB:', openErr);
      vfs = new IDBBatchAtomicVFS('tyrebuddy_idb_vfs');
      sqlite3.vfs_register(vfs, true);
      db = await sqlite3.open_v2('tyrebuddy.sqlite');
    } else {
      throw openErr;
    }
  }

  // Enable foreign keys
  await sqlite3.exec(db, 'PRAGMA foreign_keys = ON;');
  isInitialized = true;
}

/**
 * Sequential execution queue to prevent interleaved SQL statements.
 */
let executionQueue: Promise<void> = Promise.resolve();

async function handleRequest(req: WorkerRequest): Promise<any> {
  if (!initPromise) {
    initPromise = initDatabase();
  }
  await initPromise;

  if (db === null) {
    throw new Error('Database is not open');
  }

  const { type, sql, params } = req;

  switch (type) {
    case 'init':
      return { initialized: true };

    case 'exec': {
      if (!sql) throw new Error('SQL missing for exec');
      await sqlite3.exec(db, sql);
      return { success: true };
    }

    case 'query': {
      if (!sql) throw new Error('SQL missing for query');
      const rows: Record<string, any>[] = [];

      for await (const stmt of sqlite3.statements(db, sql)) {
        if (params && params.length > 0) {
          bindParams(sqlite3, stmt, params);
        }

        const columnNames = sqlite3.column_names(stmt);

        while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
          const row: Record<string, any> = {};
          for (let i = 0; i < columnNames.length; i++) {
            let val = sqlite3.column(stmt, i);
            if (typeof val === 'bigint') {
              val = Number(val);
            }
            row[columnNames[i]] = val;
          }
          rows.push(row);
        }
      }

      return rows;
    }

    case 'execute': {
      if (!sql) throw new Error('SQL missing for execute');
      let totalChanges = 0;

      for await (const stmt of sqlite3.statements(db, sql)) {
        if (params && params.length > 0) {
          bindParams(sqlite3, stmt, params);
        }

        await sqlite3.step(stmt);
        totalChanges += sqlite3.changes(db);
      }

      return { changes: totalChanges };
    }

    case 'close': {
      if (db !== null) {
        await sqlite3.close(db);
        db = null;
        isInitialized = false;
        initPromise = null;
      }
      return { closed: true };
    }

    default:
      throw new Error(`Unknown request type: ${(req as any).type}`);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || !req.id) return;

  executionQueue = executionQueue
    .then(async () => {
      try {
        const result = await handleRequest(req);
        const response: WorkerResponse = { id: req.id, result };
        self.postMessage(response);
      } catch (err: any) {
        const response: WorkerResponse = {
          id: req.id,
          error: err?.message || String(err),
        };
        self.postMessage(response);
      }
    })
    .catch((queueErr) => {
      console.error('[SQLite Worker] Queue critical error:', queueErr);
    });
};
