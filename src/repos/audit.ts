/**
 * Audit Repository (Layer 3: Repositories)
 * Records and retrieves business audit logs in SQLite.
 * Repositories must NEVER import React.
 */

import { DbClient } from '../db/client';
import { AuditLog } from '../types';
import { AuditFilters } from './types';

export interface AuditRepo {
  log(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BACKUP' | 'RESTORE' | 'AUTH' | 'STOCK_AUDIT' | 'MERGE',
    module: string,
    details: string,
    user?: string
  ): Promise<AuditLog>;
  list(filters?: AuditFilters, limit?: number, offset?: number): Promise<AuditLog[]>;
}

export function createAuditRepo(db: DbClient): AuditRepo {
  const deviceId = 'web';

  return {
    async log(action, module, details, user = 'Operator'): Promise<AuditLog> {
      const now = new Date().toISOString();
      const id = `audit-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      await db.execute(
        `INSERT INTO audit_logs (
          id, timestamp, user, action, module, details,
          device_id, version, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
        [id, now, user, action, module, details, deviceId, now, now]
      );

      return {
        id,
        timestamp: now,
        user,
        action,
        module,
        details,
      };
    },

    async list(filters?: AuditFilters, limit = 100, offset = 0): Promise<AuditLog[]> {
      let sql = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];

      if (filters?.module) {
        sql += ' AND module = ?';
        params.push(filters.module);
      }
      if (filters?.action) {
        sql += ' AND action = ?';
        params.push(filters.action);
      }
      if (filters?.startDate) {
        sql += ' AND timestamp >= ?';
        params.push(filters.startDate);
      }
      if (filters?.endDate) {
        sql += ' AND timestamp <= ?';
        params.push(filters.endDate);
      }

      sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?;';
      params.push(limit, offset);

      const rows = await db.query<any>(sql, params);

      return rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        user: r.user,
        action: r.action,
        module: r.module,
        details: r.details,
      }));
    },
  };
}
