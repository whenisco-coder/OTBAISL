/**
 * Repository layer barrel export (Layer 3: Repositories)
 * Repositories must NEVER import React.
 */

import { db } from '../db/client';
import { createOrderRepo, OrderRepo } from './orders';
import { createCustomerRepo, CustomerRepo } from './customers';
import { createProductRepo, ProductRepo } from './products';
import { createStockRepo, StockRepo } from './stock';
import { createSettingsRepo, SettingsRepo } from './settings';
import { createAuditRepo, AuditRepo } from './audit';

export * from './types';
export * from './orders';
export * from './customers';
export * from './products';
export * from './stock';
export * from './settings';
export * from './audit';

export const orderRepo: OrderRepo = createOrderRepo(db);
export const customerRepo: CustomerRepo = createCustomerRepo(db);
export const productRepo: ProductRepo = createProductRepo(db);
export const stockRepo: StockRepo = createStockRepo(db);
export const settingsRepo: SettingsRepo = createSettingsRepo(db);
export const auditRepo: AuditRepo = createAuditRepo(db);
