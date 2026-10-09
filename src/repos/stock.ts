/**
 * Stock Repository (Layer 3: Repositories)
 * Handles stock batches, FIFO deduction, and inventory movements in SQLite.
 * Repositories must NEVER import React.
 */

import { DbClient } from '../db/client';
import { StockBatch, StockMovement, StockLocation, StockMovementType } from '../types';
import { createAuditRepo } from './audit';

export interface StockRepo {
  getBatches(productId?: string, location?: StockLocation): Promise<StockBatch[]>;
  getQty(productId: string, variantId?: string, location?: StockLocation): Promise<number>;
  deduct(
    productId: string,
    variantId: string | undefined,
    qty: number,
    reason: string,
    referenceId?: string
  ): Promise<void>;
  addBatch(batch: Omit<StockBatch, 'id'>, reason?: string): Promise<StockBatch>;
  adjust(params: {
    productId: string;
    variantId?: string;
    location: StockLocation;
    qtyDelta: number;
    type: StockMovementType;
    reason: string;
    note?: string;
    costPerUnit?: number;
    referenceId?: string;
  }): Promise<void>;
  listMovements(productId?: string, limit?: number, offset?: number): Promise<StockMovement[]>;
}

export function createStockRepo(db: DbClient): StockRepo {
  const audit = createAuditRepo(db);
  const deviceId = 'web';

  function mapBatch(r: any): StockBatch {
    return {
      id: r.id,
      productId: r.product_id,
      variantId: r.variant_id || undefined,
      location: r.location,
      qty: Number(r.qty),
      costPerUnit: Number(r.cost_per_unit),
      purchaseId: r.purchase_id || undefined,
      dateReceived: r.date_received,
    };
  }

  function mapMovement(r: any): StockMovement {
    return {
      id: r.id,
      timestamp: r.timestamp,
      productId: r.product_id,
      variantId: r.variant_id || undefined,
      productName: r.product_name,
      sku: r.sku,
      fromLocation: r.from_location || undefined,
      toLocation: r.to_location || undefined,
      qty: Number(r.qty),
      type: r.type,
      reason: r.reason,
      referenceId: r.reference_id || undefined,
      note: r.note || undefined,
    };
  }

  return {
    async getBatches(productId?: string, location?: StockLocation): Promise<StockBatch[]> {
      let sql = 'SELECT * FROM stock_batches WHERE 1=1';
      const params: any[] = [];

      if (productId) {
        sql += ' AND product_id = ?';
        params.push(productId);
      }
      if (location) {
        sql += ' AND location = ?';
        params.push(location);
      }

      sql += ' ORDER BY date_received ASC;';
      const rows = await db.query<any>(sql, params);
      return rows.map(mapBatch);
    },

    async getQty(productId: string, variantId?: string, location?: StockLocation): Promise<number> {
      let sql = 'SELECT SUM(qty) as total FROM stock_batches WHERE product_id = ?';
      const params: any[] = [productId];

      if (variantId) {
        sql += ' AND variant_id = ?';
        params.push(variantId);
      }
      if (location) {
        sql += ' AND location = ?';
        params.push(location);
      }

      const rows = await db.query<any>(sql, params);
      return Number(rows[0]?.total || 0);
    },

    async deduct(
      productId: string,
      variantId: string | undefined,
      qtyToDeduct: number,
      reason: string,
      referenceId?: string
    ): Promise<void> {
      if (qtyToDeduct <= 0) return;

      let remaining = qtyToDeduct;
      const batches = await this.getBatches(productId);

      // FIFO deduction across batches for this product/variant
      for (const batch of batches) {
        if (variantId && batch.variantId && batch.variantId !== variantId) continue;
        if (remaining <= 0) break;

        const deductFromBatch = Math.min(batch.qty, remaining);
        const newQty = batch.qty - deductFromBatch;
        remaining -= deductFromBatch;

        await db.execute(
          'UPDATE stock_batches SET qty = ?, updated_at = ? WHERE id = ?;',
          [newQty, new Date().toISOString(), batch.id]
        );
      }

      // Record movement
      const movId = `mov-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      await db.execute(
        `INSERT INTO stock_movements (
          id, timestamp, product_id, variant_id, product_name, sku,
          from_location, to_location, qty, type, reason, reference_id,
          device_id, version, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
        [
          movId,
          now,
          productId,
          variantId || null,
          'Product',
          'SKU',
          'Own',
          null,
          qtyToDeduct,
          'ORDER_DEDUCT',
          reason,
          referenceId || null,
          deviceId,
          now,
          now,
        ]
      );
    },

    async addBatch(batchData: Omit<StockBatch, 'id'>, reason = 'Purchase / Restock'): Promise<StockBatch> {
      const id = `batch-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      await db.execute(
        `INSERT INTO stock_batches (
          id, product_id, variant_id, location, qty, cost_per_unit,
          purchase_id, date_received, device_id, version, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
        [
          id,
          batchData.productId,
          batchData.variantId || null,
          batchData.location,
          batchData.qty,
          batchData.costPerUnit,
          batchData.purchaseId || null,
          batchData.dateReceived,
          deviceId,
          now,
          now,
        ]
      );

      return {
        id,
        ...batchData,
      };
    },

    async adjust(params): Promise<void> {
      const now = new Date().toISOString();
      const batches = await this.getBatches(params.productId, params.location);
      const matchingBatch = batches.find((b) => (params.variantId ? b.variantId === params.variantId : true));

      if (matchingBatch) {
        const updatedQty = Math.max(0, matchingBatch.qty + params.qtyDelta);
        await db.execute('UPDATE stock_batches SET qty = ?, updated_at = ? WHERE id = ?;', [
          updatedQty,
          now,
          matchingBatch.id,
        ]);
      } else if (params.qtyDelta > 0) {
        await this.addBatch({
          productId: params.productId,
          variantId: params.variantId,
          location: params.location,
          qty: params.qtyDelta,
          costPerUnit: params.costPerUnit || 0,
          dateReceived: now.split('T')[0],
        });
      }

      const movId = `mov-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await db.execute(
        `INSERT INTO stock_movements (
          id, timestamp, product_id, variant_id, product_name, sku,
          from_location, to_location, qty, type, reason, reference_id, note,
          device_id, version, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
        [
          movId,
          now,
          params.productId,
          params.variantId || null,
          'Product',
          'SKU',
          params.qtyDelta < 0 ? params.location : null,
          params.qtyDelta > 0 ? params.location : null,
          Math.abs(params.qtyDelta),
          params.type,
          params.reason,
          params.referenceId || null,
          params.note || null,
          deviceId,
          now,
          now,
        ]
      );

      await audit.log('UPDATE', 'Stock', `Stock adjusted: ${params.reason} (${params.qtyDelta})`);
    },

    async listMovements(productId?: string, limit = 50, offset = 0): Promise<StockMovement[]> {
      let sql = 'SELECT * FROM stock_movements WHERE 1=1';
      const params: any[] = [];

      if (productId) {
        sql += ' AND product_id = ?';
        params.push(productId);
      }

      sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?;';
      params.push(limit, offset);

      const rows = await db.query<any>(sql, params);
      return rows.map(mapMovement);
    },
  };
}
