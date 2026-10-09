/**
 * Dual-write synchronizer (Layer 2: Database Bridge)
 * Writes mutations simultaneously to SQLite without blocking UI thread.
 * Supports seeding existing localStorage state into SQLite on first initialization.
 */

import { db } from './client';
import {
  BusinessSettings,
  Customer,
  Product,
  Order,
  PaymentRecord,
  Expense,
  Task,
  AuditLog,
  StockBatch,
} from '../types';
import {
  settingsRepo,
  customerRepo,
  productRepo,
  stockRepo,
  auditRepo,
} from '../repos';

const deviceId = 'web';

/**
 * Seeds existing in-memory/localStorage data into SQLite if tables are empty.
 */
export async function seedSqliteFromStoreState(state: {
  settings: BusinessSettings;
  customers: Customer[];
  products: Product[];
  stockBatches: StockBatch[];
  orders: Order[];
  payments: PaymentRecord[];
  expenses: Expense[];
  tasks: Task[];
  auditLogs: AuditLog[];
}): Promise<void> {
  try {
    const ordersCount = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM orders;'
    );
    if ((ordersCount[0]?.count || 0) > 0) {
      // Already populated
      return;
    }

    const now = new Date().toISOString();

    // 1. Sync settings
    await settingsRepo.update(state.settings);

    // 2. Sync customers
    for (const cust of state.customers) {
      try {
        await customerRepo.create(cust);
      } catch (err) {
        // Continue on individual duplicate
      }
    }

    // 3. Sync products
    for (const prod of state.products) {
      try {
        await productRepo.create(prod);
      } catch (err) {
        // Continue on individual duplicate
      }
    }

    // 4. Sync stock batches
    for (const batch of state.stockBatches) {
      try {
        await stockRepo.addBatch(batch);
      } catch (err) {
        // Continue on individual duplicate
      }
    }

    // 5. Sync orders & items
    for (const order of state.orders) {
      try {
        await db.transaction(async (tx) => {
          await tx.execute(
            `INSERT OR IGNORE INTO orders (
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
              order.id,
              order.orderNo,
              order.invoiceNo || null,
              order.customerId,
              order.customerName,
              order.customerPhone,
              order.customerType,
              order.customerGstin || null,
              order.shippingAddress.addressLine,
              order.shippingAddress.city,
              order.shippingAddress.state,
              order.shippingAddress.pincode,
              order.shippingAddress.label || null,
              order.billingAddress?.addressLine || null,
              order.billingAddress?.city || null,
              order.billingAddress?.state || null,
              order.billingAddress?.pincode || null,
              order.orderDate,
              order.dueDate,
              order.subtotal,
              order.discountPercent,
              order.discountAmount,
              order.isGujarat ? 1 : 0,
              order.cgstTotal,
              order.sgstTotal,
              order.igstTotal,
              order.taxTotal,
              order.roundOff ?? null,
              order.grandTotal,
              order.paymentStatus,
              order.amountPaid,
              order.deliveryStatus,
              order.source,
              order.courierName || null,
              order.awbNumber || null,
              order.notes || null,
              order.internalNotes || null,
              order.isProforma ? 1 : 0,
              order.creditNoteRef || null,
              order.shipments ? JSON.stringify(order.shipments) : null,
              order.rtoDetails ? JSON.stringify(order.rtoDetails) : null,
              deviceId,
              order.createdAt || now,
              now,
            ]
          );

          for (const it of order.items) {
            await tx.execute(
              `INSERT OR IGNORE INTO order_items (
                id, order_id, product_id, variant_id, name, sku, hsn, gst_percent,
                unit_price, qty, discount, taxable_amount, cgst_amount, sgst_amount,
                igst_amount, total_amount, has_battery, battery_type, is_combo,
                combo_details_json, device_id, version, sync_status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
              [
                it.id,
                order.id,
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
                order.createdAt || now,
                now,
              ]
            );
          }
        });
      } catch (err) {
        // Continue on individual order error
      }
    }

    // 6. Sync payments
    for (const pay of state.payments) {
      await db.execute(
        `INSERT OR IGNORE INTO payments (
          id, order_id, customer_id, customer_name, supplier_id, supplier_name,
          amount, mode, reference_number, date, type, note,
          device_id, version, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
        [
          pay.id,
          pay.orderId || null,
          pay.customerId || null,
          pay.customerName || null,
          pay.supplierId || null,
          pay.supplierName || null,
          pay.amount,
          pay.mode,
          pay.referenceNumber || null,
          pay.date,
          pay.type,
          pay.note || null,
          deviceId,
          now,
          now,
        ]
      );
    }
  } catch (err) {
    console.warn('[DualWrite] Seed state to SQLite encountered error:', err);
  }
}

export const dualWrite = {
  async saveOrder(order: Order): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.transaction(async (tx) => {
        await tx.execute(
          `INSERT OR REPLACE INTO orders (
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
            order.id,
            order.orderNo,
            order.invoiceNo || null,
            order.customerId,
            order.customerName,
            order.customerPhone,
            order.customerType,
            order.customerGstin || null,
            order.shippingAddress.addressLine,
            order.shippingAddress.city,
            order.shippingAddress.state,
            order.shippingAddress.pincode,
            order.shippingAddress.label || null,
            order.billingAddress?.addressLine || null,
            order.billingAddress?.city || null,
            order.billingAddress?.state || null,
            order.billingAddress?.pincode || null,
            order.orderDate,
            order.dueDate,
            order.subtotal,
            order.discountPercent,
            order.discountAmount,
            order.isGujarat ? 1 : 0,
            order.cgstTotal,
            order.sgstTotal,
            order.igstTotal,
            order.taxTotal,
            order.roundOff ?? null,
            order.grandTotal,
            order.paymentStatus,
            order.amountPaid,
            order.deliveryStatus,
            order.source,
            order.courierName || null,
            order.awbNumber || null,
            order.notes || null,
            order.internalNotes || null,
            order.isProforma ? 1 : 0,
            order.creditNoteRef || null,
            order.shipments ? JSON.stringify(order.shipments) : null,
            order.rtoDetails ? JSON.stringify(order.rtoDetails) : null,
            deviceId,
            order.createdAt || now,
            now,
          ]
        );

        await tx.execute('DELETE FROM order_items WHERE order_id = ?;', [order.id]);

        for (const it of order.items) {
          await tx.execute(
            `INSERT INTO order_items (
              id, order_id, product_id, variant_id, name, sku, hsn, gst_percent,
              unit_price, qty, discount, taxable_amount, cgst_amount, sgst_amount,
              igst_amount, total_amount, has_battery, battery_type, is_combo,
              combo_details_json, device_id, version, sync_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
            [
              it.id,
              order.id,
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
              order.createdAt || now,
              now,
            ]
          );
        }
      });
    } catch (err) {
      console.error('[DualWrite] Save order failed:', err);
    }
  },

  async updateSettings(settings: Partial<BusinessSettings>): Promise<void> {
    try {
      await settingsRepo.update(settings);
    } catch (err) {
      console.error('[DualWrite] Update settings failed:', err);
    }
  },

  async saveCustomer(customer: Customer): Promise<void> {
    try {
      const existing = await customerRepo.getById(customer.id);
      if (existing) {
        await customerRepo.update(customer.id, customer);
      } else {
        await customerRepo.create(customer);
      }
    } catch (err) {
      console.error('[DualWrite] Save customer failed:', err);
    }
  },

  async deleteCustomer(id: string): Promise<void> {
    try {
      await customerRepo.delete(id);
    } catch (err) {
      console.error('[DualWrite] Delete customer failed:', err);
    }
  },

  async saveProduct(product: Product): Promise<void> {
    try {
      const existing = await productRepo.getById(product.id);
      if (existing) {
        await productRepo.update(product.id, product);
      } else {
        await productRepo.create(product);
      }
    } catch (err) {
      console.error('[DualWrite] Save product failed:', err);
    }
  },

  async deleteProduct(id: string): Promise<void> {
    try {
      await productRepo.delete(id);
    } catch (err) {
      console.error('[DualWrite] Delete product failed:', err);
    }
  },

  async savePayment(payment: PaymentRecord): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT OR REPLACE INTO payments (
          id, order_id, customer_id, customer_name, supplier_id, supplier_name,
          amount, mode, reference_number, date, type, note,
          device_id, version, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
        [
          payment.id,
          payment.orderId || null,
          payment.customerId || null,
          payment.customerName || null,
          payment.supplierId || null,
          payment.supplierName || null,
          payment.amount,
          payment.mode,
          payment.referenceNumber || null,
          payment.date,
          payment.type,
          payment.note || null,
          deviceId,
          now,
          now,
        ]
      );
    } catch (err) {
      console.error('[DualWrite] Save payment failed:', err);
    }
  },

  async saveExpense(expense: Expense): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT OR REPLACE INTO expenses (
          id, expense_no, date, category, amount, payment_mode, note,
          receipt_image_url, is_recurring, recurring_frequency,
          device_id, version, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
        [
          expense.id,
          expense.expenseNo,
          expense.date,
          expense.category,
          expense.amount,
          expense.paymentMode,
          expense.note || null,
          expense.receiptImageUrl || null,
          expense.isRecurring ? 1 : 0,
          expense.recurringFrequency || null,
          deviceId,
          expense.createdAt || now,
          now,
        ]
      );
    } catch (err) {
      console.error('[DualWrite] Save expense failed:', err);
    }
  },

  async saveTask(task: Task): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT OR REPLACE INTO tasks (
          id, title, due_date, priority, linked_type, linked_id, linked_title,
          recurring, completed, device_id, version, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'local', ?, ?);`,
        [
          task.id,
          task.title,
          task.dueDate,
          task.priority,
          task.linkedType || null,
          task.linkedId || null,
          task.linkedTitle || null,
          task.recurring || null,
          task.completed ? 1 : 0,
          deviceId,
          task.createdAt || now,
          now,
        ]
      );
    } catch (err) {
      console.error('[DualWrite] Save task failed:', err);
    }
  },

  async deleteTask(id: string): Promise<void> {
    try {
      await db.execute('DELETE FROM tasks WHERE id = ?;', [id]);
    } catch (err) {
      console.error('[DualWrite] Delete task failed:', err);
    }
  },

  async saveAuditLog(entry: AuditLog): Promise<void> {
    try {
      await auditRepo.log(entry.action, entry.module, entry.details, entry.user);
    } catch (err) {
      console.error('[DualWrite] Save audit log failed:', err);
    }
  },
};
