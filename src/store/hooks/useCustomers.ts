/**
 * Layer 5: State - useCustomers hook
 * Wraps CustomerRepo and provides reactive customers state.
 */

import { useState, useEffect, useCallback } from 'react';
import { customerRepo } from '../../repos';
import { Customer } from '../../types';
import { CustomerFilters } from '../../repos/types';

export function useCustomers(filters?: CustomerFilters) {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const customers = await customerRepo.list(filters);
      setData(customers);
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
    createCustomer: customerRepo.create.bind(customerRepo),
    updateCustomer: customerRepo.update.bind(customerRepo),
    deleteCustomer: customerRepo.delete.bind(customerRepo),
  };
}
