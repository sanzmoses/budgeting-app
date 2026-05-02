import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useToast } from '../providers/ToastProvider'
import { readJsonResponse } from '../lib/http'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function currentDate() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function compactFmt(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export default function ReportsPage({ token, onAddExpense }) {
  const { showToast } = useToast()
  const [mode, setMode] = useState('monthly')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [selectedDate, setSelectedDate] = useState(currentDate())
  const [monthlySummary, setMonthlySummary] = useState(null)
  const [dailySummary, setDailySummary] = useState(null)
  const [breakdown, setBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const monthlyQuery = useMemo(() => {
    const params = new URLSearchParams({ period: 'monthly', month: selectedMonth })
    return params.toString()
  }, [selectedMonth])

  const dailyQuery = useMemo(() => {
    const params = new URLSearchParams({ period: 'daily', date: selectedDate })
    return params.toString()
  }, [selectedDate])

  const breakdownQuery = useMemo(() => {
    const params = new URLSearchParams({ period: mode })
    if (mode === 'daily') params.set('date', selectedDate)
    if (mode === 'monthly') params.set('month', selectedMonth)
    return params.toString()
  }, [mode, selectedDate, selectedMonth])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([
      fetch(`${API_BASE_URL}/reports/summary?${monthlyQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => readJsonResponse(res, 'Failed to load monthly summary')),
      fetch(`${API_BASE_URL}/reports/summary?${dailyQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => readJsonResponse(res, 'Failed to load daily summary')),
      fetch(`${API_BASE_URL}/reports/category-breakdown?${breakdownQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => readJsonResponse(res, 'Failed to load expense breakdown')),
    ])
      .then(([monthlyPayload, dailyPayload, breakdownPayload]) => {
        if (cancelled) return
        setMonthlySummary(monthlyPayload)
        setDailySummary(dailyPayload)
        setBreakdown(breakdownPayload)
      })
      .catch((err) => {
        if (cancelled) return
        const nextError = err.message || 'Could not load reports'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, monthlyQuery, dailyQuery, breakdownQuery, showToast])

  const expenseCards = breakdown?.breakdown || []

  return (
    <div className="reports-page reports-dashboard-page">
      {loading && <p className="form-loading">Loading reports…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && monthlySummary && dailySummary && (
        <>
          <section className="report-hero-card">
            <p className="reports-hero-kicker">Overview</p>

            <div className="report-hero-value-wrap">
              <span className="report-hero-label">This month</span>
              <div className="report-hero-value">₱{compactFmt(monthlySummary.expense_total)}</div>
            </div>

            <div className="report-hero-footer">
              <div className="report-hero-daily">
                <span className="report-hero-daily-label">Today</span>
                <strong>₱{fmt(dailySummary.expense_total)}</strong>
              </div>
              <button type="button" className="report-add-expense-btn" onClick={onAddExpense}>
                <span>Add expense</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </section>

          <section className="report-panel report-panel--category-cards">
            <div className="report-panel-head report-panel-head--stacked-mobile">
              <div>
                <h3 className="section-title section-title--report-panel">Expense Breakdown</h3>
                <p className="report-panel-period">
                  {new Date(selectedMonth + '-02').toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {expenseCards.length === 0 ? (
              <p className="txn-empty">No expense categories for this period.</p>
            ) : (
              <div className="report-category-card-grid">
                {expenseCards.map((item, index) => {
                  const label = item.category_name || item.subcategory_name || 'Uncategorized'
                  return (
                    <article
                      key={`${item.category_id || 'uncat'}-${item.subcategory_id || index}`}
                      className="report-category-card"
                    >
                      <div className="report-category-card-value">₱{compactFmt(item.total_amount)}</div>
                      <div className="report-category-card-label">{label}</div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
