-- Migration 001: Initial Tyrebuddy SQLite Schema
-- Created: 2026-10-09

-- Settings Singleton
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  business_name TEXT NOT NULL,
  gstin TEXT NOT NULL,
  state TEXT NOT NULL,
  state_code TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  branch TEXT NOT NULL,
  upi_id TEXT NOT NULL,
  logo_url TEXT,
  signature_url TEXT,
  pin TEXT NOT NULL,
  password TEXT,
  is_dark_mode INTEGER NOT NULL DEFAULT 0,
  last_backup_date TEXT NOT NULL,
  saved_couriers_json TEXT NOT NULL DEFAULT '[]',
  serviceable_pincodes_json TEXT NOT NULL DEFAULT '[]',
  categories_json TEXT NOT NULL DEFAULT '[]',
  whatsapp_templates_json TEXT NOT NULL DEFAULT '[]',
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Master Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Master Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  type TEXT NOT NULL,
  gstin TEXT,
  discount_percent REAL NOT NULL DEFAULT 0,
  credit_days INTEGER NOT NULL DEFAULT 0,
  credit_limit REAL,
  notes TEXT,
  tags_json TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Customer Addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Master Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  hsn TEXT NOT NULL,
  gst_percent REAL NOT NULL,
  cost_price REAL NOT NULL,
  mrp REAL NOT NULL,
  retail_price REAL NOT NULL,
  warranty_months INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  has_battery INTEGER NOT NULL DEFAULT 0,
  battery_type TEXT,
  combo_children_json TEXT,
  barcode TEXT,
  sku TEXT,
  images_json TEXT,
  tags_json TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  price_history_json TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT NOT NULL,
  amazon_fnsku TEXT,
  attributes_json TEXT NOT NULL,
  price_delta REAL DEFAULT 0,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gstin TEXT NOT NULL,
  address TEXT NOT NULL,
  state TEXT NOT NULL,
  notes TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Inventory: Stock Batches
CREATE TABLE IF NOT EXISTS stock_batches (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  location TEXT NOT NULL,
  qty REAL NOT NULL,
  cost_per_unit REAL NOT NULL,
  purchase_id TEXT,
  date_received TEXT NOT NULL,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Inventory: Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  from_location TEXT,
  to_location TEXT,
  qty REAL NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  note TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Inventory: Stock Audits
CREATE TABLE IF NOT EXISTS stock_audits (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL,
  reconciled_at TEXT,
  notes TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Inventory: Stock Audit Items
CREATE TABLE IF NOT EXISTS stock_audit_items (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES stock_audits(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  system_qty REAL NOT NULL,
  counted_qty REAL NOT NULL,
  discrepancy REAL NOT NULL,
  note TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Core Transactional: Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  invoice_no TEXT,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_type TEXT NOT NULL,
  customer_gstin TEXT,
  shipping_address_line TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_pincode TEXT NOT NULL,
  shipping_label TEXT,
  billing_address_line TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_pincode TEXT,
  order_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  is_gujarat INTEGER NOT NULL DEFAULT 1,
  cgst_total REAL NOT NULL DEFAULT 0,
  sgst_total REAL NOT NULL DEFAULT 0,
  igst_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  round_off REAL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL,
  source TEXT NOT NULL,
  courier_name TEXT,
  awb_number TEXT,
  notes TEXT,
  internal_notes TEXT,
  is_proforma INTEGER NOT NULL DEFAULT 0,
  credit_note_ref TEXT,
  shipments_json TEXT,
  rto_details_json TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Core Transactional: Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  hsn TEXT NOT NULL,
  gst_percent REAL NOT NULL,
  unit_price REAL NOT NULL,
  qty REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  taxable_amount REAL NOT NULL,
  cgst_amount REAL NOT NULL DEFAULT 0,
  sgst_amount REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  has_battery INTEGER NOT NULL DEFAULT 0,
  battery_type TEXT,
  is_combo INTEGER NOT NULL DEFAULT 0,
  combo_details_json TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  customer_id TEXT,
  customer_name TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  amount REAL NOT NULL,
  mode TEXT NOT NULL,
  reference_number TEXT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Credit Notes
CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  credit_note_no TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  invoice_no TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total_refund_amount REAL NOT NULL,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Purchases: Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_no TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  date TEXT NOT NULL,
  expected_date TEXT,
  items_json TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Purchases: Goods Receipt Notes
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id TEXT PRIMARY KEY,
  grn_no TEXT NOT NULL UNIQUE,
  po_id TEXT,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  received_date TEXT NOT NULL,
  location TEXT NOT NULL,
  items_json TEXT NOT NULL,
  freight REAL NOT NULL DEFAULT 0,
  other_charges REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Purchases: Purchases Bills
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  purchase_no TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  bill_date TEXT NOT NULL,
  items_json TEXT NOT NULL,
  freight REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  location TEXT NOT NULL,
  status TEXT NOT NULL,
  po_id TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Purchases: Purchase Returns
CREATE TABLE IF NOT EXISTS purchase_returns (
  id TEXT PRIMARY KEY,
  return_no TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  purchase_id TEXT,
  date TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total_refund_amount REAL NOT NULL,
  reason TEXT NOT NULL,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Operations: Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  expense_no TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  note TEXT,
  receipt_image_url TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_frequency TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Operations: Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  priority TEXT NOT NULL,
  linked_type TEXT,
  linked_id TEXT,
  linked_title TEXT,
  recurring TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Operations: Drafts
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_type TEXT,
  customer_gstin TEXT,
  items_json TEXT NOT NULL DEFAULT '[]',
  discount_percent REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  delivery_status TEXT NOT NULL DEFAULT 'Pending',
  source TEXT NOT NULL DEFAULT 'Direct',
  courier_name TEXT,
  awb_number TEXT,
  notes TEXT,
  internal_notes TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Operations: Order Templates
CREATE TABLE IF NOT EXISTS order_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  customer_id TEXT,
  customer_type TEXT,
  items_json TEXT NOT NULL,
  notes TEXT,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- System: Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT NOT NULL,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_no ON orders(invoice_no);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_prod_loc ON stock_batches(product_id, location);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_cust_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_prod_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_id ON stock_movements(product_id);
