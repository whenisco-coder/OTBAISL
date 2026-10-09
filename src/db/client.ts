/**
 * Async SQLite query client called from main thread (Layer 2: Database)
 * Communicates with SQLite Web Worker over postMessage protocol.
 * Enforces ACID transactions with sequential lock queue.
 */

export interface DbClient {
  query<T = Record<string, any>>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertId?: string }>;
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

interface WorkerMessageResponse {
  id: string;
  result?: any;
  error?: string;
}

class SqliteWorkerClient implements DbClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: Error) => void }
  >();
  private reqCounter = 0;
  private txMutex: Promise<any> = Promise.resolve();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event: MessageEvent<WorkerMessageResponse>) => {
      const { id, result, error } = event.data;
      const pending = this.pendingRequests.get(id);
      if (!pending) return;

      this.pendingRequests.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    };

    this.worker.onerror = (err) => {
      console.error('[SQLite Client] Worker uncaught error:', err);
    };
  }

  private send<T>(type: 'init' | 'query' | 'execute' | 'exec' | 'close', sql?: string, params?: any[]): Promise<T> {
    if (!this.worker) {
      this.initWorker();
    }
    if (!this.worker) {
      return Promise.reject(new Error('Web Worker unavailable'));
    }

    const id = `req_${++this.reqCounter}_${Date.now()}`;
    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ id, type, sql, params });
    });
  }

  async query<T = Record<string, any>>(sql: string, params?: any[]): Promise<T[]> {
    return this.send<T[]>('query', sql, params);
  }

  async execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertId?: string }> {
    return this.send<{ changes: number; lastInsertId?: string }>('execute', sql, params);
  }

  async exec(sql: string): Promise<void> {
    await this.send<void>('exec', sql);
  }

  async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    // Acquire mutex to prevent concurrent transactions from interleaving
    const release = this.txMutex;
    let nextResolve: () => void;
    this.txMutex = new Promise<void>((resolve) => {
      nextResolve = resolve;
    });

    await release;

    try {
      await this.execute('BEGIN IMMEDIATE TRANSACTION;');
      const result = await fn(this);
      await this.execute('COMMIT;');
      return result;
    } catch (err) {
      try {
        await this.execute('ROLLBACK;');
      } catch (rollbackErr) {
        console.warn('[SQLite Client] Rollback failed:', rollbackErr);
      }
      throw err;
    } finally {
      nextResolve!();
    }
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.send<void>('close');
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const db: DbClient = new SqliteWorkerClient();
