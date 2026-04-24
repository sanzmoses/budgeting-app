import { useState } from 'react'
import { useToast } from './ToastProvider'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export default function EditTransactionModal({ txn, bootstrap, token, onSaved, onClose }) {
  const { showToast } = useToast()
  const type = txn.type

  const [date, setDate] = useState(txn.transaction_date)
  const [amount, setAmount] = useState(String(txn.amount))
  const [description, setDescription] = useState(txn.description || '')

  const [accountId, setAccountId] = useState(String(txn.account_id || ''))
  const [categoryId, setCategoryId] = useState(String(txn.category_id || ''))
  const [subcategoryId, setSubcategoryId] = useState(String(txn.subcategory_id || ''))
  const [placeId, setPlaceId] = useState(String(txn.place_id || ''))

  const [sourceId, setSourceId] = useState(String(txn.income_source_id || ''))

  const [fromId, setFromId] = useState(String(txn.from_account_id || ''))
  const [toId, setToId] = useState(String(txn.to_account_id || ''))
  const [transferLabel, setTransferLabel] = useState(txn.transfer_label || '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subcategories = bootstrap
    ? bootstrap.subcategories.filter(s => s.category_id === Number(categoryId))
    : []

  function handleCategoryChange(e) {
    setCategoryId(e.target.value)
    setSubcategoryId('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (type === 'transfer' && fromId === toId) {
      const nextError = 'Source and destination accounts must be different'
      setError(nextError)
      showToast({ tone: 'warning', message: nextError })
      return
    }

    setLoading(true)
    try {
      const body = {
        transaction_date: date,
        amount: parseFloat(amount),
        description: description || undefined,
      }

      if (type === 'expense') {
        body.account_id = Number(accountId)
        body.category_id = Number(categoryId)
        body.subcategory_id = Number(subcategoryId)
        body.place_id = placeId ? Number(placeId) : undefined
      } else if (type === 'income') {
        body.account_id = Number(accountId)
        body.income_source_id = Number(sourceId)
      } else if (type === 'transfer') {
        body.from_account_id = Number(fromId)
        body.to_account_id = Number(toId)
        body.transfer_label = transferLabel || undefined
      }

      const res = await fetch(`${API_BASE_URL}/transactions/${txn.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const nextError = data.error || 'Failed to save changes'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
        return
      }
      onSaved(data)
    } catch {
      setError('Could not reach the server')
      showToast({ tone: 'error', message: 'Could not reach the server' })
    } finally {
      setLoading(false)
    }
  }

  const submitDisabled = loading || !date || !amount ||
    (type === 'expense' && (!accountId || !categoryId || !subcategoryId)) ||
    (type === 'income' && (!accountId || !sourceId)) ||
    (type === 'transfer' && (!fromId || !toId))

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>Edit {type.charAt(0).toUpperCase() + type.slice(1)}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

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
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {type === 'expense' && (
            <>
              <div className="form-group">
                <label>Account</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} required disabled={loading}>
                  <option value="">— select account —</option>
                  {bootstrap.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={categoryId} onChange={handleCategoryChange} required disabled={loading}>
                    <option value="">— category —</option>
                    {bootstrap.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subcategory</label>
                  <select value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)} required disabled={loading || !categoryId}>
                    <option value="">— subcategory —</option>
                    {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Place <span className="optional">(optional)</span></label>
                <select value={placeId} onChange={e => setPlaceId(e.target.value)} disabled={loading}>
                  <option value="">— none —</option>
                  {bootstrap.places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          )}

          {type === 'income' && (
            <>
              <div className="form-group">
                <label>Destination Account</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} required disabled={loading}>
                  <option value="">— select account —</option>
                  {bootstrap.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Income Source</label>
                <select value={sourceId} onChange={e => setSourceId(e.target.value)} required disabled={loading}>
                  <option value="">— select source —</option>
                  {bootstrap.income_sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </>
          )}

          {type === 'transfer' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>From Account</label>
                  <select value={fromId} onChange={e => setFromId(e.target.value)} required disabled={loading}>
                    <option value="">— from —</option>
                    {bootstrap.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>To Account</label>
                  <select value={toId} onChange={e => setToId(e.target.value)} required disabled={loading}>
                    <option value="">— to —</option>
                    {bootstrap.accounts.map(a => (
                      <option key={a.id} value={a.id} disabled={a.id === Number(fromId)}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Label <span className="optional">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Travel, Emergency"
                  value={transferLabel}
                  onChange={e => setTransferLabel(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
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

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-submit btn-submit--${type}`}
              disabled={submitDisabled}
            >
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
