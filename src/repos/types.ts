/**
 * Shared repository types (Layer 3: Repositories)
 * Repositories must NEVER import React.
 */

export interface QueryResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface OrderFilters {
  customerId?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface CustomerFilters {
  type?: 'B2C' | 'B2B';
  searchQuery?: string;
}

export interface ProductFilters {
  category?: string;
  brand?: string;
  isArchived?: boolean;
  searchQuery?: string;
}

export interface StockFilters {
  location?: string;
  productId?: string;
}

export interface AuditFilters {
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}
