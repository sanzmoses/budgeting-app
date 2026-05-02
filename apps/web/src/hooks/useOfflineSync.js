import { useEffect, useRef, useState } from 'react'
import { getSyncQueueCounts, retryFailedSyncQueueItems, syncPendingTransactionCreates } from '../offline/sync'

export function useOfflineSync({ enabled, refreshKey = 0, onSyncComplete } = {}) {
  const runningRef = useRef(false)
  const [summary, setSummary] = useState({ pending: 0, syncing: 0, failed: 0 })

  useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      const counts = await getSyncQueueCounts()
      if (!cancelled) setSummary(counts)
    }

    loadCounts()

    return () => { cancelled = true }
  }, [refreshKey])

  useEffect(() => {
    if (!enabled || runningRef.current) return

    let cancelled = false

    async function runSync() {
      runningRef.current = true
      try {
        await retryFailedSyncQueueItems()
        const result = await syncPendingTransactionCreates()
        const counts = await getSyncQueueCounts()
        if (!cancelled) {
          setSummary(counts)
          onSyncComplete?.(result)
        }
      } finally {
        runningRef.current = false
      }
    }

    runSync()

    return () => { cancelled = true }
  }, [enabled, refreshKey, onSyncComplete])

  return summary
}
