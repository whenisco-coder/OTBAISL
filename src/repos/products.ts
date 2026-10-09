/**
 * Product Repository (Layer 3: Repositories)
 * Business logic and multi-table transactions for products and variants in SQLite.
 * Repositories must NEVER import React.
 */

import { DbClient } from '../db/client';
import { Product, ProductVariant } from '../types';
import { ProductFilters } from './types';
import { createAuditRepo } from './audit';

export interface ProductRepo {
  create(input: Omit<Product, 'id' | 'createdAt'>): Promise<Product>;
  getById(id: string): Promise<Product | null>;
  list(filters?: ProductFilters, limit?: number, offset?: number): Promise<Product[]>;
  update(id: string, updates: Partial<Product>): Promise<Product>;
  delete(id: string): Promise<void>;
}

export function createProductRepo(db: DbClient): ProductRepo {
  const audit = createAuditRepo(db);
  const deviceId = 'web';

  function mapProduct(r: any, variants: ProductVariant[]): Product {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      category: r.category,
      brand: r.brand,
      hsn: r.hsn,
      gstPercent: Number(r.gst_percent),
      costPrice: Number(r.cost_price),
      mrp: Number(r.mrp),
      retailPrice: Number(r.retail_price),
      warrantyMonths: Number(r.warranty_months),
      lowStockThreshold: Number(r.low_stock_threshold),
      hasBattery: Boolean(r.has_battery),
      batteryType: r.battery_type || undefined,
      variants,
      comboChildren: r.combo_children_json ? JSON.parse(r.combo_children_json) : undefined,
      barcode: r.barcode || undefined,
      sku: r.sku || undefined,
      images: r.images_json ? JSON.parse(r.images_json) : undefined,
      tags: r.tags_json ? JSON.parse(r.tags_json) : undefined,
      isArchived: Boolean(r.is_archived),
      priceHistory: r.price_history_json ? JSON.parse(r.price_history_json) : undefined,
      createdAt: r.created_at,
    };
  }

  function mapVariant(r: any): ProductVariant {
    return {
      id: r.id,
      productId: r.product_id,
      title: r.title,
      sku: r.sku,
      barcode: r.barcode,
      amazonFnsku: r.amazon_fnsku || undefined,
      attributes: r.attributes_json ? JSON.parse(r.attributes_json) : {},
      priceDelta: r.price_delta !== null ? Number(r.price_delta) : undefined,
    };
  }

  return {
    async create(input: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
      return db.transaction(async (tx) => {
        const id = `prod-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toISOString();

        await tx.execute(
          `INSERT INTO products (
            id, name, type, category, brand, hsn, gst_percent, cost_price, mrp,
            retail_price, warranty_months, low_stock_threshold, has_battery, battery_type,
            combo_children_json, barcode, sku, images_json, tags_json, is_archived,
            price_history_json, device_id, version, sync_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
          [
            id,
            input.name,
            input.type,
            input.category,
            input.brand,
            input.hsn,
            input.gstPercent,
            input.costPrice,
            input.mrp,
            input.retailPrice,
            input.warrantyMonths,
            input.lowStockThreshold,
            input.hasBattery ? 1 : 0,
            input.batteryType || null,
            input.comboChildren ? JSON.stringify(input.comboChildren) : null,
            input.barcode || null,
            input.sku || null,
            input.images ? JSON.stringify(input.images) : null,
            input.tags ? JSON.stringify(input.tags) : null,
            input.isArchived ? 1 : 0,
            input.priceHistory ? JSON.stringify(input.priceHistory) : null,
            deviceId,
            now,
            now,
          ]
        );

        const createdVariants: ProductVariant[] = [];
        if (input.variants) {
          for (const v of input.variants) {
            const varId = v.id || `var-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            await tx.execute(
              `INSERT INTO product_variants (
                id, product_id, title, sku, barcode, amazon_fnsku, attributes_json,
                price_delta, device_id, version, sync_status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
              [
                varId,
                id,
                v.title,
                v.sku,
                v.barcode,
                v.amazonFnsku || null,
                JSON.stringify(v.attributes || {}),
                v.priceDelta ?? null,
                deviceId,
                now,
                now,
              ]
            );
            createdVariants.push({ ...v, id: varId, productId: id });
          }
        }

        await audit.log('CREATE', 'Products', `Created product ${input.name} (${input.category})`);

        return {
          id,
          ...input,
          variants: createdVariants,
          createdAt: now,
        };
      });
    },

    async getById(id: string): Promise<Product | null> {
      const rows = await db.query<any>('SELECT * FROM products WHERE id = ? LIMIT 1;', [id]);
      if (rows.length === 0) return null;

      const varRows = await db.query<any>('SELECT * FROM product_variants WHERE product_id = ?;', [id]);
      return mapProduct(rows[0], varRows.map(mapVariant));
    },

    async list(filters?: ProductFilters, limit = 100, offset = 0): Promise<Product[]> {
      let sql = 'SELECT * FROM products WHERE 1=1';
      const params: any[] = [];

      if (filters?.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }
      if (filters?.brand) {
        sql += ' AND brand = ?';
        params.push(filters.brand);
      }
      if (filters?.isArchived !== undefined) {
        sql += ' AND is_archived = ?';
        params.push(filters.isArchived ? 1 : 0);
      }
      if (filters?.searchQuery) {
        sql += ' AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR brand LIKE ?)';
        const term = `%${filters.searchQuery}%`;
        params.push(term, term, term, term);
      }

      sql += ' ORDER BY name ASC LIMIT ? OFFSET ?;';
      params.push(limit, offset);

      const prodRows = await db.query<any>(sql, params);
      if (prodRows.length === 0) return [];

      const prodIds = prodRows.map((p) => p.id);
      const placeholders = prodIds.map(() => '?').join(',');
      const varRows = await db.query<any>(
        `SELECT * FROM product_variants WHERE product_id IN (${placeholders});`,
        prodIds
      );

      const varsByProd = new Map<string, ProductVariant[]>();
      for (const r of varRows) {
        const variant = mapVariant(r);
        if (!varsByProd.has(r.product_id)) {
          varsByProd.set(r.product_id, []);
        }
        varsByProd.get(r.product_id)!.push(variant);
      }

      return prodRows.map((r) => mapProduct(r, varsByProd.get(r.id) || []));
    },

    async update(id: string, updates: Partial<Product>): Promise<Product> {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Product ${id} not found`);

      const merged: Product = { ...existing, ...updates };
      const now = new Date().toISOString();

      await db.transaction(async (tx) => {
        await tx.execute(
          `UPDATE products SET
            name = ?, type = ?, category = ?, brand = ?, hsn = ?, gst_percent = ?,
            cost_price = ?, mrp = ?, retail_price = ?, warranty_months = ?,
            low_stock_threshold = ?, has_battery = ?, battery_type = ?,
            combo_children_json = ?, barcode = ?, sku = ?, images_json = ?,
            tags_json = ?, is_archived = ?, price_history_json = ?,
            updated_at = ?, version = version + 1
          WHERE id = ?;`,
          [
            merged.name,
            merged.type,
            merged.category,
            merged.brand,
            merged.hsn,
            merged.gstPercent,
            merged.costPrice,
            merged.mrp,
            merged.retailPrice,
            merged.warrantyMonths,
            merged.lowStockThreshold,
            merged.hasBattery ? 1 : 0,
            merged.batteryType || null,
            merged.comboChildren ? JSON.stringify(merged.comboChildren) : null,
            merged.barcode || null,
            merged.sku || null,
            merged.images ? JSON.stringify(merged.images) : null,
            merged.tags ? JSON.stringify(merged.tags) : null,
            merged.isArchived ? 1 : 0,
            merged.priceHistory ? JSON.stringify(merged.priceHistory) : null,
            now,
            id,
          ]
        );

        if (updates.variants) {
          await tx.execute('DELETE FROM product_variants WHERE product_id = ?;', [id]);
          for (const v of updates.variants) {
            const varId = v.id || `var-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            await tx.execute(
              `INSERT INTO product_variants (
                id, product_id, title, sku, barcode, amazon_fnsku, attributes_json,
                price_delta, device_id, version, sync_status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
              [
                varId,
                id,
                v.title,
                v.sku,
                v.barcode,
                v.amazonFnsku || null,
                JSON.stringify(v.attributes || {}),
                v.priceDelta ?? null,
                deviceId,
                now,
                now,
              ]
            );
          }
        }

        await audit.log('UPDATE', 'Products', `Updated product ${merged.name}`);
      });

      return merged;
    },

    async delete(id: string): Promise<void> {
      const existing = await this.getById(id);
      if (!existing) return;

      await db.transaction(async (tx) => {
        await tx.execute('DELETE FROM product_variants WHERE product_id = ?;', [id]);
        await tx.execute('DELETE FROM products WHERE id = ?;', [id]);
        await audit.log('DELETE', 'Products', `Deleted product ${existing.name}`);
      });
    },
  };
}
