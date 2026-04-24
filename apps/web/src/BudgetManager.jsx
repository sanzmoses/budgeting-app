import { useEffect, useMemo, useState } from 'react'
import { useToast } from './ToastProvider'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function fmt(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function BudgetManager({ token, bootstrap, refreshKey, onChanged }) {
  const { showToast } = useToast()
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingCategoryId, setSavingCategoryId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    setMessage('')

    fetch(`${API_BASE_URL}/budgets?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || 'Failed to load budgets')
        setData(payload)
        const nextDrafts = {}
        payload.budgets.forEach((budget) => {
          nextDrafts[budget.category_id] = String(budget.amount)
        })
        setDrafts(nextDrafts)
      })
      .catch((err) => {
        const nextError = err.message || 'Could not load budgets'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
      })
      .finally(() => setLoading(false))
  }, [token, month, refreshKey])

  const budgetsByCategoryId = useMemo(() => {
    const map = new Map()
    if (data?.budgets) {
      data.budgets.forEach((budget) => map.set(budget.category_id, budget))
    }
    return map
  }, [data])

  const totalMonthlyBudget = useMemo(() => {
    if (!data?.budgets) return 0
    return data.budgets.reduce((sum, budget) => sum + Number(budget.amount || 0), 0)
  }, [data])

  async function saveBudget(categoryId) {
    const raw = drafts[categoryId] ?? ''
    const amount = Number(raw)

    if (raw === '' || Number.isNaN(amount) || amount < 0) {
      const nextError = 'Budget amount must be 0 or greater'
      setError(nextError)
      showToast({ tone: 'warning', message: nextError })
      return
    }

    setSavingCategoryId(categoryId)
    setError('')
    setMessage('')

    const existing = budgetsByCategoryId.get(categoryId)
    const method = existing ? 'PUT' : 'POST'
    const url = existing
      ? `${API_BASE_URL}/budgets/${existing.id}`
      : `${API_BASE_URL}/budgets`

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month,
          category_id: categoryId,
          amount,
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        const nextError = payload.error || 'Failed to save budget'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
        return
      }

      setData((prev) => {
        if (!prev) return prev
        const others = prev.budgets.filter((budget) => budget.category_id !== categoryId)
        return {
          ...prev,
          budgets: [...others, payload].sort((a, b) => a.category_name.localeCompare(b.category_name)),
        }
      })
      setDrafts((prev) => ({ ...prev, [categoryId]: String(payload.amount) }))
      const nextMessage = `Saved budget for ${payload.category_name}`
      setMessage(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      onChanged?.()
    } catch {
      setError('Could not reach the server')
      showToast({ tone: 'error', message: 'Could not reach the server' })
    } finally {
      setSavingCategoryId(null)
    }
  }

  if (!bootstrap) return <p className="form-loading">Loading categories…</p>

  return (
    <div className="budget-manager">
      <div className="budget-toolbar">
        <label className="budget-month-label">
          <span>Month</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="month-picker" />
        </label>
      </div>

      {loading && <p className="form-loading">Loading budgets…</p>}
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}

      {!loading && (
        <>
          <div className="budget-summary-card budget-summary-card--monthly-total">
            <div className="budget-summary-title">Monthly Budget Total</div>
            <div className="budget-monthly-total-value">PHP {fmt(totalMonthlyBudget)}</div>
            <div className="budget-summary-meta">Sum of all category budgets for {month}.</div>
          </div>

          <div className="budget-list">
            {bootstrap.categories.map((category) => {
              const budget = budgetsByCategoryId.get(category.id)
              const spent = Number(budget?.spent_amount || 0)
              const amount = Number(budget?.amount || 0)
              const remaining = amount - spent

              return (
                <div key={category.id} className="budget-item">
                  <div className="budget-item-head">
                    <div>
                      <div className="budget-category">{category.name}</div>
                      <div className="budget-meta">
                        Budget: PHP {fmt(amount)} · Spent: PHP {fmt(spent)} · Remaining:{' '}
                        <span className={remaining < 0 ? 'budget-negative' : ''}>
                          PHP {fmt(remaining)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="budget-item-form">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={drafts[category.id] ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [category.id]: e.target.value }))}
                      disabled={savingCategoryId === category.id}
                    />
                    <button
                      type="button"
                      className="btn-submit"
                      onClick={() => saveBudget(category.id)}
                      disabled={savingCategoryId === category.id}
                    >
                      {savingCategoryId === category.id ? 'Saving…' : budget ? 'Update' : 'Set Budget'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
