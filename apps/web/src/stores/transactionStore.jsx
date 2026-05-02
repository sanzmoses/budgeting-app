import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { transactionService } from '../services/transactionService'
import { getOfflineTransactionsByMonth } from '../offline/transactions'
import { toOfflineTransactionView } from '../offline/txnView'
import { useBootstrapStore } from './bootstrapStore'

const TransactionStoreContext = createContext(null)

export function TransactionStoreProvider({ children }) {
  const { data: bootstrap } = useBootstrapStore()
  const bootstrapRef = useRef(bootstrap)
  bootstrapRef.current = bootstrap

  const [cache, setCache] = useState(new Map())
  const [loadingKeys, setLoadingKeys] = useState(new Set())
  const [errors, setErrors] = useState(new Map())
  const [refreshVersion, setRefreshVersion] = useState(0)
  const cacheRef = useRef(cache)
  const loadingRef = useRef(loadingKeys)
  cacheRef.current = cache
  loadingRef.current = loadingKeys

  const fetchTransactions = useCallback(async (month, type = '', force = false) => {
    if (!month) return
    const key = `${month}:${type}`
    if (!force && cacheRef.current.has(key)) return
    if (loadingRef.current.has(key)) return

    setLoadingKeys(prev => new Set([...prev, key]))
    setErrors(prev => { const n = new Map(prev); n.delete(key); return n })

    try {
      const data = await transactionService.getByMonth(month, type)
      setCache(prev => new Map(prev).set(key, data))
    } catch (apiErr) {
      try {
        const offlineRows = await getOfflineTransactionsByMonth(month, type)
        if (offlineRows.length > 0) {
          setCache(prev => new Map(prev).set(key, {
            transactions: offlineRows.map(row => toOfflineTransactionView(row, bootstrapRef.current)),
            count: offlineRows.length,
            offlineOnly: true,
          }))
        } else {
          setErrors(prev => new Map(prev).set(key, apiErr.message || 'Could not load transactions'))
        }
      } catch {
        setErrors(prev => new Map(prev).set(key, apiErr.message || 'Could not load transactions'))
      }
    } finally {
      setLoadingKeys(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }, [])

  const invalidateTransactions = useCallback((month, type) => {
    if (month !== undefined) {
      const key = `${month}:${type ?? ''}`
      setCache(prev => { const n = new Map(prev); n.delete(key); return n })
    } else {
      setCache(new Map())
    }
    setRefreshVersion(v => v + 1)
  }, [])

  const createTransaction = useCallback(async (data) => {
    const result = await transactionService.create(data)
    invalidateTransactions()
    return result
  }, [invalidateTransactions])

  const updateTransaction = useCallback(async (id, data) => {
    const result = await transactionService.update(id, data)
    invalidateTransactions()
    return result
  }, [invalidateTransactions])

  const deleteTransaction = useCallback(async (id) => {
    const result = await transactionService.delete(id)
    invalidateTransactions()
    return result
  }, [invalidateTransactions])

  const value = useMemo(
    () => ({
      cache, loadingKeys, errors, refreshVersion,
      fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
      invalidateTransactions,
    }),
    [
      cache, loadingKeys, errors, refreshVersion,
      fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
      invalidateTransactions,
    ]
  )

  return (
    <TransactionStoreContext.Provider value={value}>
      {children}
    </TransactionStoreContext.Provider>
  )
}

export function useTransactionStore(month, type = '') {
  const {
    cache, loadingKeys, errors, refreshVersion,
    fetchTransactions, invalidateTransactions,
  } = useContext(TransactionStoreContext)
  const key = month ? `${month}:${type}` : null

  useEffect(() => {
    if (month) fetchTransactions(month, type)
  }, [month, type, refreshVersion, fetchTransactions])

  return {
    data: key ? (cache.get(key) ?? null) : null,
    loading: key ? loadingKeys.has(key) : false,
    error: key ? (errors.get(key) ?? null) : null,
    invalidate: () => invalidateTransactions(month, type),
    invalidateAll: () => invalidateTransactions(),
    refresh: () => { if (month) fetchTransactions(month, type, true) },
  }
}

export function useTransactionActions() {
  const {
    createTransaction,
    updateTransaction,
    deleteTransaction,
    invalidateTransactions,
  } = useContext(TransactionStoreContext)

  return {
    createTransaction,
    updateTransaction,
    deleteTransaction,
    invalidateTransactions,
  }
}
