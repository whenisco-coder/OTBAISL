/**
 * Layer 5: State - useSettings hook
 * Wraps SettingsRepo and provides reactive business settings state.
 */

import { useState, useEffect, useCallback } from 'react';
import { settingsRepo } from '../../repos';
import { BusinessSettings } from '../../types';

export function useSettings() {
  const [data, setData] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await settingsRepo.get();
      setData(settings);
      setError(null);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const update = useCallback(
    async (updates: Partial<BusinessSettings>) => {
      try {
        const updated = await settingsRepo.update(updates);
        setData(updated);
        return updated;
      } catch (err: any) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    []
  );

  return {
    data,
    loading,
    error,
    refetch,
    updateSettings: update,
  };
}
