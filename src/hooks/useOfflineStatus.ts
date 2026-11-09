import { useState, useEffect } from 'react';
import { offlineSyncEngine, OfflineSyncStatus } from '../services/offlineSyncEngine';

export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineSyncStatus>(offlineSyncEngine.getStatus());

  useEffect(() => {
    const unsubscribe = offlineSyncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const syncNow = async () => {
    return await offlineSyncEngine.processOutbox();
  };

  return {
    ...status,
    syncNow,
  };
}
