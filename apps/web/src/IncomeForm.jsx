import { useState } from 'react'
import { useToast } from './ToastProvider'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function IncomeForm({ token, bootstrap, onCreated }) {
  const { showToast } = useToast()
  const [date, setDate] = useState(today())
  const [accountId, setAccountId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'income',
          transaction_date: date,
          account_id: Number(accountId),
          income_source_id: Number(sourceId),
          amount: parseFloat(amount),
          description: description || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const nextError = data.error || 'Failed to save income'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
        return
      }
      const nextMessage = `Income saved (ID ${data.id})`
      setSuccess(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      setAmount('')
      setDescription('')
      onCreated?.()
    } catch {
      setError('Could not reach the server')
      showToast({ tone: 'error', message: 'Could not reach the server' })
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
        <label>Destination Account</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} required disabled={loading}>
          <option value="">— select account —</option>
          {bootstrap.accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Income Source</label>
        <select value={sourceId} onChange={e => setSourceId(e.target.value)} required disabled={loading}>
          <option value="">— select source —</option>
          {bootstrap.income_sources.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

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
        className="btn-submit btn-income"
        disabled={loading || !date || !accountId || !sourceId || !amount}
      >
        {loading ? 'Saving…' : 'Save Income'}
      </button>
    </form>
  )
}
