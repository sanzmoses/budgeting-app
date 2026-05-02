import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../providers/ToastProvider'
import { useBootstrapStore } from '../stores/bootstrapStore'
import { useBudgetStore } from '../stores/budgetStore'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function fmt(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function BudgetManager({ onChanged }) {
  const { showToast } = useToast()
  const { data: bootstrap } = useBootstrapStore()
  const [month, setMonth] = useState(currentMonth())
  const { data, loading, error, saveBudget: persistBudget } = useBudgetStore(month)

  const [savingCategoryId, setSavingCategoryId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [saveError, setSaveError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!data?.budgets) return
    const nextDrafts = {}
    data.budgets.forEach((b) => {
      nextDrafts[b.category_id] = String(b.amount)
    })
    setDrafts(nextDrafts)
  }, [data])

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

  async function handleSaveBudget(categoryId) {
    const raw = drafts[categoryId] ?? ''
    const amount = Number(raw)

    if (raw === '' || Number.isNaN(amount) || amount < 0) {
      const nextError = 'Budget amount must be 0 or greater'
      setSaveError(nextError)
      showToast({ tone: 'warning', message: nextError })
      return
    }

    setSavingCategoryId(categoryId)
    setSaveError('')
    setMessage('')

    const existing = budgetsByCategoryId.get(categoryId)

    try {
      await persistBudget(existing?.id, { month, category_id: categoryId, amount })

      const nextMessage = `Saved budget for ${existing?.category_name ?? String(categoryId)}`
      setMessage(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      onChanged?.()
    } catch (err) {
      const nextError = err.message || 'Could not reach the server'
      setSaveError(nextError)
      showToast({ tone: 'error', message: nextError })
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
      {(error || saveError) && <p className="form-error">{error || saveError}</p>}
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
                      onClick={() => handleSaveBudget(category.id)}
                      disabled={savingCategoryId === category.id}
                    >
                      {savingCategoryId === category.id ? 'Saving…' : budget?.id ? 'Update' : 'Set Budget'}
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
