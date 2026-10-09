/**
 * Layer 5: State - useProducts hook
 * Wraps ProductRepo and provides reactive products state.
 */

import { useState, useEffect, useCallback } from 'react';
import { productRepo } from '../../repos';
import { Product } from '../../types';
import { ProductFilters } from '../../repos/types';

export function useProducts(filters?: ProductFilters) {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const products = await productRepo.list(filters);
      setData(products);
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
    createProduct: productRepo.create.bind(productRepo),
    updateProduct: productRepo.update.bind(productRepo),
    deleteProduct: productRepo.delete.bind(productRepo),
  };
}
