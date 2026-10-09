/**
 * Order Repository (Layer 3: Repositories)
 * Business logic and ACID multi-table transactions for orders and line items in SQLite.
 * Repositories must NEVER import React.
 */

import { DbClient } from '../db/client';
import { Order, OrderItem } from '../types';
import { OrderFilters } from './types';
import { createAuditRepo } from './audit';
import { createStockRepo } from './stock';

export type CreateOrderInput = Omit<Order, 'id' | 'orderNo' | 'createdAt'> & {
  orderNo?: string;
  invoiceNo?: string;
};

export interface OrderRepo {
  create(input: CreateOrderInput): Promise<Order>;
  getById(id: string): Promise<Order | null>;
  list(filters?: OrderFilters, limit?: number, offset?: number): Promise<Order[]>;
  update(id: string, updates: Partial<Order>): Promise<Order>;
  delete(id: string): Promise<void>;
  nextOrderNumber(): Promise<string>;
  nextInvoiceNumber(): Promise<string>;
}

export function createOrderRepo(db: DbClient): OrderRepo {
  const audit = createAuditRepo(db);
  const stock = createStockRepo(db);
  const deviceId = 'web';

  function mapRowToOrder(r: any, items: OrderItem[]): Order {
    return {
      id: r.id,
      orderNo: r.order_no,
      invoiceNo: r.invoice_no || undefined,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerType: r.customer_type,
      customerGstin: r.customer_gstin || undefined,
      shippingAddress: {
        addressLine: r.shipping_address_line,
        city: r.shipping_city,
        state: r.shipping_state,
        pincode: r.shipping_pincode,
        label: r.shipping_label || undefined,
      },
      billingAddress: r.billing_address_line
        ? {
            addressLine: r.billing_address_line,
            city: r.billing_city,
            state: r.billing_state,
            pincode: r.billing_pincode,
          }
        : undefined,
      orderDate: r.order_date,
      dueDate: r.due_date,
      items,
      subtotal: Number(r.subtotal),
      discountPercent: Number(r.discount_percent),
      discountAmount: Number(r.discount_amount),
      isGujarat: Boolean(r.is_gujarat),
      cgstTotal: Number(r.cgst_total),
      sgstTotal: Number(r.sgst_total),
      igstTotal: Number(r.igst_total),
      taxTotal: Number(r.tax_total),
      roundOff: r.round_off !== null ? Number(r.round_off) : undefined,
      grandTotal: Number(r.grand_total),
      paymentStatus: r.payment_status,
      amountPaid: Number(r.amount_paid),
      deliveryStatus: r.delivery_status,
      source: r.source,
      courierName: r.courier_name || undefined,
      awbNumber: r.awb_number || undefined,
      notes: r.notes || undefined,
      internalNotes: r.internal_notes || undefined,
      isProforma: Boolean(r.is_proforma),
      creditNoteRef: r.credit_note_ref || undefined,
      shipments: r.shipments_json ? JSON.parse(r.shipments_json) : undefined,
      rtoDetails: r.rto_details_json ? JSON.parse(r.rto_details_json) : undefined,
      createdAt: r.created_at,
    };
  }

  function mapRowToOrderItem(r: any): OrderItem {
    return {
      id: r.id,
      productId: r.product_id,
      variantId: r.variant_id || undefined,
      name: r.name,
      sku: r.sku,
      hsn: r.hsn,
      gstPercent: Number(r.gst_percent),
      unitPrice: Number(r.unit_price),
      qty: Number(r.qty),
      discount: Number(r.discount),
      taxableAmount: Number(r.taxable_amount),
      cgstAmount: Number(r.cgst_amount),
      sgstAmount: Number(r.sgst_amount),
      igstAmount: Number(r.igst_amount),
      totalAmount: Number(r.total_amount),
      hasBattery: Boolean(r.has_battery),
      batteryType: r.battery_type || undefined,
      isCombo: Boolean(r.is_combo),
      comboChildrenDetails: r.combo_details_json ? JSON.parse(r.combo_details_json) : undefined,
    };
  }

  return {
    async nextOrderNumber(): Promise<string> {
      const year = new Date().getFullYear();
      const rows = await db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM orders WHERE order_no LIKE ?;',
        [`ORD-${year}-%`]
      );
      const nextSeq = (rows[0]?.count || 0) + 1;
      return `ORD-${year}-${String(nextSeq).padStart(4, '0')}`;
    },

    async nextInvoiceNumber(): Promise<string> {
      const year = new Date().getFullYear();
      const rows = await db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM orders WHERE invoice_no LIKE ?;',
        [`INV-${year}-%`]
      );
      const nextSeq = (rows[0]?.count || 0) + 1;
      return `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
    },

    async create(input: CreateOrderInput): Promise<Order> {
      return db.transaction(async (tx) => {
        // 1. Validate & prepare order identifiers
        const orderNo = input.orderNo || (await this.nextOrderNumber());
        const invoiceNo = input.invoiceNo || (await this.nextInvoiceNumber());
        const orderId = `order-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toISOString();

        // 2. Insert into orders table
        await tx.execute(
          `INSERT INTO orders (
            id, order_no, invoice_no, customer_id, customer_name, customer_phone,
            customer_type, customer_gstin, shipping_address_line, shipping_city,
            shipping_state, shipping_pincode, shipping_label, billing_address_line,
            billing_city, billing_state, billing_pincode, order_date, due_date,
            subtotal, discount_percent, discount_amount, is_gujarat, cgst_total,
            sgst_total, igst_total, tax_total, round_off, grand_total, payment_status,
            amount_paid, delivery_status, source, courier_name, awb_number, notes,
            internal_notes, is_proforma, credit_note_ref, shipments_json, rto_details_json,
            device_id, version, sync_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
          [
            orderId,
            orderNo,
            invoiceNo,
            input.customerId,
            input.customerName,
            input.customerPhone,
            input.customerType,
            input.customerGstin || null,
            input.shippingAddress.addressLine,
            input.shippingAddress.city,
            input.shippingAddress.state,
            input.shippingAddress.pincode,
            input.shippingAddress.label || null,
            input.billingAddress?.addressLine || null,
            input.billingAddress?.city || null,
            input.billingAddress?.state || null,
            input.billingAddress?.pincode || null,
            input.orderDate,
            input.dueDate,
            input.subtotal,
            input.discountPercent,
            input.discountAmount,
            input.isGujarat ? 1 : 0,
            input.cgstTotal,
            input.sgstTotal,
            input.igstTotal,
            input.taxTotal,
            input.roundOff ?? null,
            input.grandTotal,
            input.paymentStatus,
            input.amountPaid,
            input.deliveryStatus,
            input.source,
            input.courierName || null,
            input.awbNumber || null,
            input.notes || null,
            input.internalNotes || null,
            input.isProforma ? 1 : 0,
            input.creditNoteRef || null,
            input.shipments ? JSON.stringify(input.shipments) : null,
            input.rtoDetails ? JSON.stringify(input.rtoDetails) : null,
            deviceId,
            now,
            now,
          ]
        );

        // 3. Insert each item into order_items table and deduct stock
        const createdItems: OrderItem[] = [];
        for (const it of input.items) {
          const itemId = it.id || `item-${deviceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await tx.execute(
            `INSERT INTO order_items (
              id, order_id, product_id, variant_id, name, sku, hsn, gst_percent,
              unit_price, qty, discount, taxable_amount, cgst_amount, sgst_amount,
              igst_amount, total_amount, has_battery, battery_type, is_combo,
              combo_details_json, device_id, version, sync_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
            [
              itemId,
              orderId,
              it.productId,
              it.variantId || null,
              it.name,
              it.sku,
              it.hsn,
              it.gstPercent,
              it.unitPrice,
              it.qty,
              it.discount,
              it.taxableAmount,
              it.cgstAmount,
              it.sgstAmount,
              it.igstAmount,
              it.totalAmount,
              it.hasBattery ? 1 : 0,
              it.batteryType || null,
              it.isCombo ? 1 : 0,
              it.comboChildrenDetails ? JSON.stringify(it.comboChildrenDetails) : null,
              deviceId,
              now,
              now,
            ]
          );

          createdItems.push({ ...it, id: itemId });

          // 4. FIFO stock deduction
          await stock.deduct(it.productId, it.variantId, it.qty, `Order ${orderNo}`, orderId);
        }

        // 5. Write audit log entry
        await audit.log('CREATE', 'Orders', `Created order ${orderNo} for ${input.customerName}`);

        return {
          id: orderId,
          orderNo,
          invoiceNo,
          ...input,
          items: createdItems,
          createdAt: now,
        };
      });
    },

    async getById(id: string): Promise<Order | null> {
      const orderRows = await db.query<any>('SELECT * FROM orders WHERE id = ? LIMIT 1;', [id]);
      if (orderRows.length === 0) return null;

      const itemRows = await db.query<any>('SELECT * FROM order_items WHERE order_id = ?;', [id]);
      const items = itemRows.map(mapRowToOrderItem);

      return mapRowToOrder(orderRows[0], items);
    },

    async list(filters?: OrderFilters, limit = 100, offset = 0): Promise<Order[]> {
      let sql = 'SELECT * FROM orders WHERE 1=1';
      const params: any[] = [];

      if (filters?.customerId) {
        sql += ' AND customer_id = ?';
        params.push(filters.customerId);
      }
      if (filters?.paymentStatus) {
        sql += ' AND payment_status = ?';
        params.push(filters.paymentStatus);
      }
      if (filters?.deliveryStatus) {
        sql += ' AND delivery_status = ?';
        params.push(filters.deliveryStatus);
      }
      if (filters?.source) {
        sql += ' AND source = ?';
        params.push(filters.source);
      }
      if (filters?.startDate) {
        sql += ' AND order_date >= ?';
        params.push(filters.startDate);
      }
      if (filters?.endDate) {
        sql += ' AND order_date <= ?';
        params.push(filters.endDate);
      }
      if (filters?.searchQuery) {
        sql += ' AND (order_no LIKE ? OR invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
        const term = `%${filters.searchQuery}%`;
        params.push(term, term, term, term);
      }

      sql += ' ORDER BY order_date DESC, created_at DESC LIMIT ? OFFSET ?;';
      params.push(limit, offset);

      const orderRows = await db.query<any>(sql, params);
      if (orderRows.length === 0) return [];

      const orderIds = orderRows.map((o) => o.id);
      const placeholders = orderIds.map(() => '?').join(',');
      const itemRows = await db.query<any>(
        `SELECT * FROM order_items WHERE order_id IN (${placeholders});`,
        orderIds
      );

      const itemsByOrder = new Map<string, OrderItem[]>();
      for (const r of itemRows) {
        const item = mapRowToOrderItem(r);
        if (!itemsByOrder.has(r.order_id)) {
          itemsByOrder.set(r.order_id, []);
        }
        itemsByOrder.get(r.order_id)!.push(item);
      }

      return orderRows.map((r) => mapRowToOrder(r, itemsByOrder.get(r.id) || []));
    },

    async update(id: string, updates: Partial<Order>): Promise<Order> {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Order ${id} not found`);

      const merged: Order = { ...existing, ...updates };
      const now = new Date().toISOString();

      await db.transaction(async (tx) => {
        await tx.execute(
          `UPDATE orders SET
            order_no = ?, invoice_no = ?, customer_id = ?, customer_name = ?,
            customer_phone = ?, customer_type = ?, customer_gstin = ?,
            shipping_address_line = ?, shipping_city = ?, shipping_state = ?,
            shipping_pincode = ?, shipping_label = ?, billing_address_line = ?,
            billing_city = ?, billing_state = ?, billing_pincode = ?, order_date = ?,
            due_date = ?, subtotal = ?, discount_percent = ?, discount_amount = ?,
            is_gujarat = ?, cgst_total = ?, sgst_total = ?, igst_total = ?,
            tax_total = ?, round_off = ?, grand_total = ?, payment_status = ?,
            amount_paid = ?, delivery_status = ?, source = ?, courier_name = ?,
            awb_number = ?, notes = ?, internal_notes = ?, is_proforma = ?,
            credit_note_ref = ?, shipments_json = ?, rto_details_json = ?,
            updated_at = ?, version = version + 1
          WHERE id = ?;`,
          [
            merged.orderNo,
            merged.invoiceNo || null,
            merged.customerId,
            merged.customerName,
            merged.customerPhone,
            merged.customerType,
            merged.customerGstin || null,
            merged.shippingAddress.addressLine,
            merged.shippingAddress.city,
            merged.shippingAddress.state,
            merged.shippingAddress.pincode,
            merged.shippingAddress.label || null,
            merged.billingAddress?.addressLine || null,
            merged.billingAddress?.city || null,
            merged.billingAddress?.state || null,
            merged.billingAddress?.pincode || null,
            merged.orderDate,
            merged.dueDate,
            merged.subtotal,
            merged.discountPercent,
            merged.discountAmount,
            merged.isGujarat ? 1 : 0,
            merged.cgstTotal,
            merged.sgstTotal,
            merged.igstTotal,
            merged.taxTotal,
            merged.roundOff ?? null,
            merged.grandTotal,
            merged.paymentStatus,
            merged.amountPaid,
            merged.deliveryStatus,
            merged.source,
            merged.courierName || null,
            merged.awbNumber || null,
            merged.notes || null,
            merged.internalNotes || null,
            merged.isProforma ? 1 : 0,
            merged.creditNoteRef || null,
            merged.shipments ? JSON.stringify(merged.shipments) : null,
            merged.rtoDetails ? JSON.stringify(merged.rtoDetails) : null,
            now,
            id,
          ]
        );

        await audit.log('UPDATE', 'Orders', `Updated order ${merged.orderNo}`);
      });

      return merged;
    },

    async delete(id: string): Promise<void> {
      const existing = await this.getById(id);
      if (!existing) return;

      await db.transaction(async (tx) => {
        await tx.execute('DELETE FROM order_items WHERE order_id = ?;', [id]);
        await tx.execute('DELETE FROM orders WHERE id = ?;', [id]);
        await audit.log('DELETE', 'Orders', `Deleted order ${existing.orderNo}`);
      });
    },
  };
}
