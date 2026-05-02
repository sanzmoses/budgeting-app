import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { bootstrapService } from '../services/bootstrapService'
import { getBootstrapCache, getLastBootstrapSyncAt, saveBootstrapCache } from '../offline/db'

const BootstrapStoreContext = createContext(null)

export function BootstrapStoreProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('network')
  const [syncedAt, setSyncedAt] = useState(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const fetchedRef = useRef(false)

  const load = useCallback(async (force = false) => {
    if (fetchedRef.current && !force) return
    fetchedRef.current = true
    setLoading(true)
    setError(null)
    try {
      const payload = await bootstrapService.get()
      const newSyncedAt = await saveBootstrapCache(payload)
      setData(payload)
      setSource('network')
      setSyncedAt(newSyncedAt)
    } catch {
      const cached = await getBootstrapCache()
      const cachedSyncedAt = await getLastBootstrapSyncAt()
      if (cached?.payload) {
        setData(cached.payload)
        setSource('cache')
        setSyncedAt(cached.syncedAt || cachedSyncedAt)
        setError('Using cached form options while offline.')
      } else {
        setError('Could not load form options. Is the API running?')
        fetchedRef.current = false
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const invalidate = useCallback(() => {
    fetchedRef.current = false
    setData(null)
    setError(null)
    setRefreshVersion(v => v + 1)
  }, [])

  useEffect(() => { load() }, [load, refreshVersion])

  const value = useMemo(
    () => ({ data, loading, error, source, syncedAt, load, invalidate }),
    [data, loading, error, source, syncedAt, load, invalidate]
  )

  return (
    <BootstrapStoreContext.Provider value={value}>
      {children}
    </BootstrapStoreContext.Provider>
  )
}

export function useBootstrapStore() {
  return useContext(BootstrapStoreContext)
}

export function useBootstrapActions() {
  const { invalidate } = useContext(BootstrapStoreContext)
  return { invalidateBootstrap: invalidate }
}
