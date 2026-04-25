import { useEffect, useMemo, useState } from 'react'
import { useToast } from './ToastProvider'

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

function SummaryCard({ label, value, tone }) {
  return (
    <div className={`report-card report-card--${tone}`}>
      <div className="report-card-label">{label}</div>
      <div className="report-card-value">PHP {fmt(value)}</div>
    </div>
  )
}

function SummaryBars({ summary }) {
  const items = [
    { key: 'income', label: 'Income', value: Number(summary?.income_total || 0), tone: 'income' },
    { key: 'expense', label: 'Expense', value: Number(summary?.expense_total || 0), tone: 'expense' },
    { key: 'savings', label: 'Savings', value: Number(summary?.savings_total || 0), tone: 'transfer' },
  ]
  const max = Math.max(...items.map(item => item.value), 0)

  return (
    <div className="report-bars">
      {items.map((item) => {
        const height = max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 10 : 0) : 0
        return (
          <div key={item.key} className="report-bars-item">
            <div className="report-bars-value">PHP {fmt(item.value)}</div>
            <div className="report-bars-track">
              <div className={`report-bars-fill report-bars-fill--${item.tone}`} style={{ height: `${height}%` }} />
            </div>
            <div className="report-bars-label">{item.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryBreakdown({ breakdown }) {
  const categories = breakdown?.categories || []
  const max = Math.max(...categories.map(item => Number(item.amount || 0)), 0)

  if (categories.length === 0) {
    return <p className="txn-empty">No expense categories for this period.</p>
  }

  return (
    <div className="report-breakdown">
      <div className="report-breakdown-chart">
        {categories.map((item) => {
          const width = max > 0 ? (Number(item.amount || 0) / max) * 100 : 0
          return (
            <div key={item.category_id} className="report-breakdown-row">
              <div className="report-breakdown-head">
                <span className="report-breakdown-name">{item.category_name}</span>
                <span className="report-breakdown-amount">PHP {fmt(item.amount)}</span>
              </div>
              <div className="report-breakdown-track">
                <div className="report-breakdown-fill" style={{ width: `${width}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <ul className="report-breakdown-list">
        {categories.map((item) => (
          <li key={item.category_id} className="report-breakdown-list-item">
            <div>
              <div className="report-breakdown-list-title">{item.category_name}</div>
              <div className="report-breakdown-list-meta">{fmt(item.percentage)}% of expenses</div>
            </div>
            <div className="report-breakdown-list-amount">PHP {fmt(item.amount)}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ReportsPage({ token }) {
  const { showToast } = useToast()
  const [mode, setMode] = useState('monthly')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [selectedDate, setSelectedDate] = useState(currentDate())
  const [summary, setSummary] = useState(null)
  const [breakdown, setBreakdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const queryString = useMemo(() => {
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
      fetch(`${API_BASE_URL}/reports/summary?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (res) => {
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Failed to load report summary')
        return payload
      }),
      fetch(`${API_BASE_URL}/reports/expenses-by-category?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (res) => {
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Failed to load expense breakdown')
        return payload
      }),
    ])
      .then(([summaryPayload, breakdownPayload]) => {
        if (cancelled) return
        setSummary(summaryPayload)
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
  }, [token, queryString, showToast])

  return (
    <div className="reports-page">
      <div className="reports-toolbar-card">
        <div className="reports-toggle" role="tablist" aria-label="Report period mode">
          <button
            type="button"
            className={`reports-toggle-btn${mode === 'monthly' ? ' active' : ''}`}
            onClick={() => setMode('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`reports-toggle-btn${mode === 'daily' ? ' active' : ''}`}
            onClick={() => setMode('daily')}
          >
            Daily
          </button>
        </div>

        <div className="reports-picker-wrap">
          {mode === 'monthly' ? (
            <label className="budget-month-label">
              <span>Month</span>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
            </label>
          ) : (
            <label className="budget-month-label">
              <span>Date</span>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </label>
          )}
        </div>
      </div>

      {loading && <p className="form-loading">Loading reports…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && summary && breakdown && (
        <>
          <div className="reports-summary-grid">
            <SummaryCard label="Income" value={summary.income_total} tone="income" />
            <SummaryCard label="Expense" value={summary.expense_total} tone="expense" />
            <SummaryCard label="Savings" value={summary.savings_total} tone="transfer" />
            <SummaryCard label="Net" value={summary.net_total} tone={summary.net_total < 0 ? 'expense' : 'neutral'} />
          </div>

          <section className="report-panel">
            <div className="report-panel-head">
              <h3 className="section-title">Summary Graph</h3>
              <p className="report-panel-sub">
                {mode === 'monthly'
                  ? `Showing totals for ${summary.month}`
                  : `Showing totals for ${summary.date}`}
              </p>
            </div>
            <SummaryBars summary={summary} />
          </section>

          <section className="report-panel">
            <div className="report-panel-head">
              <h3 className="section-title">Expense Breakdown</h3>
              <p className="report-panel-sub">
                Total expense: PHP {fmt(breakdown.expense_total)}
              </p>
            </div>
            <CategoryBreakdown breakdown={breakdown} />
          </section>
        </>
      )}
    </div>
  )
}
