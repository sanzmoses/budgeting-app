import { useMemo, useState } from 'react'
import { useToast } from '../../providers/ToastProvider'
import { queueOfflineTransactionCreate } from '../../offline/transactions'
import { useBudgetSummaryStore } from '../../stores/budgetStore'
import { useBootstrapStore } from '../../stores/bootstrapStore'
import { useTransactionActions } from '../../stores/transactionStore'

function today() {
  return new Date().toISOString().split('T')[0]
}

function monthFromDate(value) {
  return value ? value.slice(0, 7) : today().slice(0, 7)
}

function fmt(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function ExpenseForm({ onCreated }) {
  const { showToast } = useToast()
  const { data: bootstrap } = useBootstrapStore()
  const { createTransaction } = useTransactionActions()
  const [date, setDate] = useState(today())
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const subcategories = bootstrap
    ? bootstrap.subcategories.filter(s => s.category_id === Number(categoryId))
    : []

  const activeMonth = useMemo(() => monthFromDate(date), [date])
  const { data: budgetInfo, loading: budgetLoading } = useBudgetSummaryStore(activeMonth, categoryId)

  function handleCategoryChange(e) {
    setCategoryId(e.target.value)
    setSubcategoryId('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const payload = {
      type: 'expense',
      transaction_date: date,
      account_id: Number(accountId),
      category_id: Number(categoryId),
      subcategory_id: Number(subcategoryId),
      place_id: placeId ? Number(placeId) : undefined,
      amount: parseFloat(amount),
      description: description || undefined,
    }

    try {
      const data = await createTransaction(payload)
      const nextMessage = `Expense saved (ID ${data.id})`
      setSuccess(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      setAmount('')
      setDescription('')
      setPlaceId('')
      onCreated?.()
    } catch (err) {
      if (err.status) {
        const nextError = err.message || 'Failed to save expense'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
        return
      }

      try {
        await queueOfflineTransactionCreate({
          ...payload,
          place_id: placeId ? Number(placeId) : null,
          description: description || '',
        })
        const nextMessage = 'Expense saved locally. It will sync when connection returns.'
        setSuccess(nextMessage)
        showToast({ tone: 'warning', message: nextMessage })
        setAmount('')
        setDescription('')
        setPlaceId('')
        onCreated?.()
      } catch {
        setError('Could not reach the server')
        showToast({ tone: 'error', message: 'Could not reach the server' })
      }
    } finally {
      setLoading(false)
    }
  }

  if (!bootstrap) return <p className="form-loading">Loading options…</p>

  return (
    <form className="txn-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required disabled={loading} />
        </div>
        <div className="form-group">
          <label>Amount (PHP)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Account</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} required disabled={loading}>
          <option value="">— select account —</option>
          {bootstrap.accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Category</label>
          <select value={categoryId} onChange={handleCategoryChange} required disabled={loading}>
            <option value="">— category —</option>
            {bootstrap.categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Subcategory</label>
          <select value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)} required disabled={loading || !categoryId}>
            <option value="">— subcategory —</option>
            {subcategories.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Place <span className="optional">(optional)</span></label>
        <select value={placeId} onChange={e => setPlaceId(e.target.value)} disabled={loading}>
          <option value="">— none —</option>
          {bootstrap.places.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {categoryId && (
        <div className="budget-summary-card">
          <div className="budget-summary-title">Budget for {activeMonth}</div>
          {budgetLoading && <div className="budget-summary-meta">Loading budget…</div>}
          {!budgetLoading && budgetInfo && (
            <>
              <div className="budget-summary-grid">
                <div>
                  <span className="budget-summary-label">Budget</span>
                  <strong>PHP {fmt(budgetInfo.budget_amount)}</strong>
                </div>
                <div>
                  <span className="budget-summary-label">Spent</span>
                  <strong>PHP {fmt(budgetInfo.spent_amount)}</strong>
                </div>
                <div>
                  <span className="budget-summary-label">Remaining</span>
                  <strong className={budgetInfo.remaining_amount < 0 ? 'budget-negative' : ''}>
                    PHP {fmt(budgetInfo.remaining_amount)}
                  </strong>
                </div>
              </div>
              {!budgetInfo.has_budget && (
                <div className="budget-summary-meta">No monthly budget set yet for this category.</div>
              )}
            </>
          )}
        </div>
      )}

      <div className="form-group">
        <label>Description <span className="optional">(optional)</span></label>
        <input
          type="text"
          placeholder="Notes…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <button
        type="submit"
        className="btn-submit"
        disabled={loading || !date || !accountId || !categoryId || !subcategoryId || !amount}
      >
        {loading ? 'Saving…' : 'Save Expense'}
      </button>
    </form>
  )
}
