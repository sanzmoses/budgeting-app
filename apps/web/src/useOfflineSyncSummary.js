import { useEffect, useState } from 'react'
import { getPendingSyncCount } from './offlineTransactions'

export function useOfflineSyncSummary(refreshKey = 0) {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const count = await getPendingSyncCount()
      if (!cancelled) setPendingCount(count)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return { pendingCount }
}
