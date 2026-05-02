import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { budgetService } from '../services/budgetService'

const BudgetStoreContext = createContext(null)

export function BudgetStoreProvider({ children }) {
  const [cache, setCache] = useState(new Map())
  const [loadingKeys, setLoadingKeys] = useState(new Set())
  const [errors, setErrors] = useState(new Map())
  const [summaryCache, setSummaryCache] = useState(new Map())
  const [summaryLoadingKeys, setSummaryLoadingKeys] = useState(new Set())
  const [summaryErrors, setSummaryErrors] = useState(new Map())
  const [refreshVersion, setRefreshVersion] = useState(0)
  const cacheRef = useRef(cache)
  const loadingRef = useRef(loadingKeys)
  const summaryCacheRef = useRef(summaryCache)
  const summaryLoadingRef = useRef(summaryLoadingKeys)
  cacheRef.current = cache
  loadingRef.current = loadingKeys
  summaryCacheRef.current = summaryCache
  summaryLoadingRef.current = summaryLoadingKeys

  const fetchBudgets = useCallback(async (month, force = false) => {
    if (!month) return
    if (!force && cacheRef.current.has(month)) return
    if (loadingRef.current.has(month)) return

    setLoadingKeys(prev => new Set([...prev, month]))
    setErrors(prev => { const n = new Map(prev); n.delete(month); return n })

    try {
      const data = await budgetService.getByMonth(month)
      setCache(prev => new Map(prev).set(month, data))
    } catch (err) {
      setErrors(prev => new Map(prev).set(month, err.message || 'Could not load budgets'))
    } finally {
      setLoadingKeys(prev => { const n = new Set(prev); n.delete(month); return n })
    }
  }, [])

  const invalidateBudgets = useCallback((month) => {
    if (month) {
      setCache(prev => { const n = new Map(prev); n.delete(month); return n })
      setSummaryCache(prev => {
        const n = new Map(prev)
        Array.from(n.keys()).forEach((key) => {
          if (key.startsWith(`${month}:`)) n.delete(key)
        })
        return n
      })
    } else {
      setCache(new Map())
      setSummaryCache(new Map())
    }
    setRefreshVersion(v => v + 1)
  }, [])

  const fetchBudgetSummary = useCallback(async (month, categoryId, force = false) => {
    if (!month || !categoryId) return
    const key = `${month}:${categoryId}`
    if (!force && summaryCacheRef.current.has(key)) return
    if (summaryLoadingRef.current.has(key)) return

    setSummaryLoadingKeys(prev => new Set([...prev, key]))
    setSummaryErrors(prev => { const n = new Map(prev); n.delete(key); return n })

    try {
      const data = await budgetService.getSummary(month, categoryId)
      setSummaryCache(prev => new Map(prev).set(key, data))
    } catch (err) {
      setSummaryErrors(prev => new Map(prev).set(key, err.message || 'Could not load budget summary'))
    } finally {
      setSummaryLoadingKeys(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }, [])

  const saveBudget = useCallback(async (id, data) => {
    const result = id
      ? await budgetService.update(id, data)
      : await budgetService.create(data)
    invalidateBudgets(data.month)
    return result
  }, [invalidateBudgets])

  const value = useMemo(
    () => ({
      cache, loadingKeys, errors,
      summaryCache, summaryLoadingKeys, summaryErrors,
      refreshVersion, fetchBudgets, fetchBudgetSummary,
      saveBudget, invalidateBudgets,
    }),
    [
      cache, loadingKeys, errors,
      summaryCache, summaryLoadingKeys, summaryErrors,
      refreshVersion, fetchBudgets, fetchBudgetSummary,
      saveBudget, invalidateBudgets,
    ]
  )

  return (
    <BudgetStoreContext.Provider value={value}>
      {children}
    </BudgetStoreContext.Provider>
  )
}

export function useBudgetStore(month) {
  const {
    cache, loadingKeys, errors, refreshVersion,
    fetchBudgets, saveBudget, invalidateBudgets,
  } = useContext(BudgetStoreContext)

  useEffect(() => {
    if (month) fetchBudgets(month)
  }, [month, refreshVersion, fetchBudgets])

  return {
    data: month ? (cache.get(month) ?? null) : null,
    loading: month ? loadingKeys.has(month) : false,
    error: month ? (errors.get(month) ?? null) : null,
    saveBudget,
    invalidate: () => invalidateBudgets(month),
    invalidateAll: () => invalidateBudgets(),
    refresh: () => { if (month) fetchBudgets(month, true) },
  }
}

export function useBudgetSummaryStore(month, categoryId) {
  const {
    summaryCache, summaryLoadingKeys, summaryErrors, refreshVersion,
    fetchBudgetSummary,
  } = useContext(BudgetStoreContext)
  const key = month && categoryId ? `${month}:${categoryId}` : null

  useEffect(() => {
    if (month && categoryId) fetchBudgetSummary(month, categoryId)
  }, [month, categoryId, refreshVersion, fetchBudgetSummary])

  return {
    data: key ? (summaryCache.get(key) ?? null) : null,
    loading: key ? summaryLoadingKeys.has(key) : false,
    error: key ? (summaryErrors.get(key) ?? null) : null,
    refresh: () => { if (month && categoryId) fetchBudgetSummary(month, categoryId, true) },
  }
}

export function useBudgetActions() {
  const { invalidateBudgets } = useContext(BudgetStoreContext)
  return { invalidateBudgets }
}
