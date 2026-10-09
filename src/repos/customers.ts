/**
 * Customer Repository (Layer 3: Repositories)
 * Business logic and multi-table transactions for customers and addresses in SQLite.
 * Repositories must NEVER import React.
 */

import { DbClient } from '../db/client';
import { Customer, Address } from '../types';
import { CustomerFilters } from './types';
import { createAuditRepo } from './audit';

export interface CustomerRepo {
  create(input: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer>;
  getById(id: string): Promise<Customer | null>;
  getByPhone(phone: string): Promise<Customer | null>;
  list(filters?: CustomerFilters, limit?: number, offset?: number): Promise<Customer[]>;
  update(id: string, updates: Partial<Customer>): Promise<Customer>;
  delete(id: string): Promise<void>;
}

export function createCustomerRepo(db: DbClient): CustomerRepo {
  const audit = createAuditRepo(db);
  const deviceId = 'web';

  function mapCustomer(r: any, addresses: Address[]): Customer {
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email || undefined,
      type: r.type,
      gstin: r.gstin || undefined,
      discountPercent: Number(r.discount_percent),
      creditDays: Number(r.credit_days),
      creditLimit: r.credit_limit !== null ? Number(r.credit_limit) : undefined,
      addresses,
      notes: r.notes || undefined,
      tags: r.tags_json ? JSON.parse(r.tags_json) : undefined,
      createdAt: r.created_at,
    };
  }

  function mapAddress(r: any): Address {
    return {
      id: r.id,
      label: r.label,
      addressLine: r.address_line,
      city: r.city,
      state: r.state,
      pincode: r.pincode,
      isDefault: Boolean(r.is_default),
    };
  }

  return {
    async create(input: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
      return db.transaction(async (tx) => {
        const id = `cust-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toISOString();

        await tx.execute(
          `INSERT INTO customers (
            id, name, phone, email, type, gstin, discount_percent, credit_days,
            credit_limit, notes, tags_json, device_id, version, sync_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
          [
            id,
            input.name,
            input.phone,
            input.email || null,
            input.type,
            input.gstin || null,
            input.discountPercent,
            input.creditDays,
            input.creditLimit ?? null,
            input.notes || null,
            input.tags ? JSON.stringify(input.tags) : null,
            deviceId,
            now,
            now,
          ]
        );

        const createdAddresses: Address[] = [];
        for (const addr of input.addresses) {
          const addrId = addr.id || `addr-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await tx.execute(
            `INSERT INTO customer_addresses (
              id, customer_id, label, address_line, city, state, pincode,
              is_default, device_id, version, sync_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
            [
              addrId,
              id,
              addr.label,
              addr.addressLine,
              addr.city,
              addr.state,
              addr.pincode,
              addr.isDefault ? 1 : 0,
              deviceId,
              now,
              now,
            ]
          );
          createdAddresses.push({ ...addr, id: addrId });
        }

        await audit.log('CREATE', 'Customers', `Created customer ${input.name} (${input.phone})`);

        return {
          id,
          ...input,
          addresses: createdAddresses,
          createdAt: now,
        };
      });
    },

    async getById(id: string): Promise<Customer | null> {
      const rows = await db.query<any>('SELECT * FROM customers WHERE id = ? LIMIT 1;', [id]);
      if (rows.length === 0) return null;

      const addrRows = await db.query<any>('SELECT * FROM customer_addresses WHERE customer_id = ?;', [id]);
      return mapCustomer(rows[0], addrRows.map(mapAddress));
    },

    async getByPhone(phone: string): Promise<Customer | null> {
      const rows = await db.query<any>('SELECT * FROM customers WHERE phone = ? LIMIT 1;', [phone]);
      if (rows.length === 0) return null;

      const addrRows = await db.query<any>('SELECT * FROM customer_addresses WHERE customer_id = ?;', [rows[0].id]);
      return mapCustomer(rows[0], addrRows.map(mapAddress));
    },

    async list(filters?: CustomerFilters, limit = 100, offset = 0): Promise<Customer[]> {
      let sql = 'SELECT * FROM customers WHERE 1=1';
      const params: any[] = [];

      if (filters?.type) {
        sql += ' AND type = ?';
        params.push(filters.type);
      }
      if (filters?.searchQuery) {
        sql += ' AND (name LIKE ? OR phone LIKE ? OR gstin LIKE ?)';
        const term = `%${filters.searchQuery}%`;
        params.push(term, term, term);
      }

      sql += ' ORDER BY name ASC LIMIT ? OFFSET ?;';
      params.push(limit, offset);

      const custRows = await db.query<any>(sql, params);
      if (custRows.length === 0) return [];

      const custIds = custRows.map((c) => c.id);
      const placeholders = custIds.map(() => '?').join(',');
      const addrRows = await db.query<any>(
        `SELECT * FROM customer_addresses WHERE customer_id IN (${placeholders});`,
        custIds
      );

      const addrsByCust = new Map<string, Address[]>();
      for (const r of addrRows) {
        const addr = mapAddress(r);
        if (!addrsByCust.has(r.customer_id)) {
          addrsByCust.set(r.customer_id, []);
        }
        addrsByCust.get(r.customer_id)!.push(addr);
      }

      return custRows.map((r) => mapCustomer(r, addrsByCust.get(r.id) || []));
    },

    async update(id: string, updates: Partial<Customer>): Promise<Customer> {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Customer ${id} not found`);

      const merged: Customer = { ...existing, ...updates };
      const now = new Date().toISOString();

      await db.transaction(async (tx) => {
        await tx.execute(
          `UPDATE customers SET
            name = ?, phone = ?, email = ?, type = ?, gstin = ?, discount_percent = ?,
            credit_days = ?, credit_limit = ?, notes = ?, tags_json = ?,
            updated_at = ?, version = version + 1
          WHERE id = ?;`,
          [
            merged.name,
            merged.phone,
            merged.email || null,
            merged.type,
            merged.gstin || null,
            merged.discountPercent,
            merged.creditDays,
            merged.creditLimit ?? null,
            merged.notes || null,
            merged.tags ? JSON.stringify(merged.tags) : null,
            now,
            id,
          ]
        );

        if (updates.addresses) {
          await tx.execute('DELETE FROM customer_addresses WHERE customer_id = ?;', [id]);
          for (const addr of updates.addresses) {
            const addrId = addr.id || `addr-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            await tx.execute(
              `INSERT INTO customer_addresses (
                id, customer_id, label, address_line, city, state, pincode,
                is_default, device_id, version, sync_status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
              [
                addrId,
                id,
                addr.label,
                addr.addressLine,
                addr.city,
                addr.state,
                addr.pincode,
                addr.isDefault ? 1 : 0,
                deviceId,
                now,
                now,
              ]
            );
          }
        }

        await audit.log('UPDATE', 'Customers', `Updated customer ${merged.name}`);
      });

      return merged;
    },

    async delete(id: string): Promise<void> {
      const existing = await this.getById(id);
      if (!existing) return;

      await db.transaction(async (tx) => {
        await tx.execute('DELETE FROM customer_addresses WHERE customer_id = ?;', [id]);
        await tx.execute('DELETE FROM customers WHERE id = ?;', [id]);
        await audit.log('DELETE', 'Customers', `Deleted customer ${existing.name}`);
      });
    },
  };
}
