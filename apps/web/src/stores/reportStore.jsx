import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { reportService } from '../services/reportService'

const ReportStoreContext = createContext(null)

export function ReportStoreProvider({ children }) {
  const [cache, setCache] = useState(new Map())
  const [loadingKeys, setLoadingKeys] = useState(new Set())
  const [errors, setErrors] = useState(new Map())
  const [refreshVersion, setRefreshVersion] = useState(0)
  const cacheRef = useRef(cache)
  const loadingRef = useRef(loadingKeys)
  cacheRef.current = cache
  loadingRef.current = loadingKeys

  const fetchReport = useCallback(async (month, date, mode, force = false) => {
    if (!month || !date) return
    const key = `${month}:${date}:${mode}`
    if (!force && cacheRef.current.has(key)) return
    if (loadingRef.current.has(key)) return

    setLoadingKeys(prev => new Set([...prev, key]))
    setErrors(prev => { const n = new Map(prev); n.delete(key); return n })

    const monthlyParams = new URLSearchParams({ period: 'monthly', month })
    const dailyParams = new URLSearchParams({ period: 'daily', date })
    const breakdownParams = new URLSearchParams({ period: mode })
    if (mode === 'daily') breakdownParams.set('date', date)
    else breakdownParams.set('month', month)

    try {
      const [monthlySummary, dailySummary, breakdown] = await Promise.all([
        reportService.getSummary(monthlyParams.toString()),
        reportService.getSummary(dailyParams.toString()),
        reportService.getCategoryBreakdown(breakdownParams.toString()),
      ])
      setCache(prev => new Map(prev).set(key, { monthlySummary, dailySummary, breakdown }))
    } catch (err) {
      setErrors(prev => new Map(prev).set(key, err.message || 'Could not load reports'))
    } finally {
      setLoadingKeys(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }, [])

  const invalidateReports = useCallback(() => {
    setCache(new Map())
    setRefreshVersion(v => v + 1)
  }, [])

  const value = useMemo(
    () => ({ cache, loadingKeys, errors, refreshVersion, fetchReport, invalidateReports }),
    [cache, loadingKeys, errors, refreshVersion, fetchReport, invalidateReports]
  )

  return (
    <ReportStoreContext.Provider value={value}>
      {children}
    </ReportStoreContext.Provider>
  )
}

export function useReportStore(month, date, mode) {
  const {
    cache, loadingKeys, errors, refreshVersion,
    fetchReport, invalidateReports,
  } = useContext(ReportStoreContext)
  const key = month && date ? `${month}:${date}:${mode}` : null

  useEffect(() => {
    if (month && date) fetchReport(month, date, mode)
  }, [month, date, mode, refreshVersion, fetchReport])

  const cached = key ? cache.get(key) : null

  return {
    monthlySummary: cached?.monthlySummary ?? null,
    dailySummary: cached?.dailySummary ?? null,
    breakdown: cached?.breakdown ?? null,
    loading: key ? loadingKeys.has(key) : false,
    error: key ? (errors.get(key) ?? null) : null,
    invalidate: invalidateReports,
  }
}

export function useReportActions() {
  const { invalidateReports } = useContext(ReportStoreContext)
  return { invalidateReports }
}
