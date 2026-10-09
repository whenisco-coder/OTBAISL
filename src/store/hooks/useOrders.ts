/**
 * Layer 5: State - useOrders hook
 * Wraps OrderRepo and provides reactive orders state.
 */

import { useState, useEffect, useCallback } from 'react';
import { orderRepo } from '../../repos';
import { Order } from '../../types';
import { OrderFilters } from '../../repos/types';

export function useOrders(filters?: OrderFilters) {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const orders = await orderRepo.list(filters);
      setData(orders);
      setError(null);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    loading,
    error,
    refetch,
    createOrder: orderRepo.create.bind(orderRepo),
    updateOrder: orderRepo.update.bind(orderRepo),
    deleteOrder: orderRepo.delete.bind(orderRepo),
  };
}
