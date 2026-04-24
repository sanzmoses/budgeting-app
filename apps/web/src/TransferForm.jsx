import { useState } from 'react'
import { useToast } from './ToastProvider'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function TransferForm({ token, bootstrap, onCreated }) {
  const { showToast } = useToast()
  const [date, setDate] = useState(today())
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (fromId === toId) {
      const nextError = 'Source and destination accounts must be different'
      setError(nextError)
      showToast({ tone: 'warning', message: nextError })
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'transfer',
          transaction_date: date,
          from_account_id: Number(fromId),
          to_account_id: Number(toId),
          amount: parseFloat(amount),
          transfer_label: label || undefined,
          description: description || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const nextError = data.error || 'Failed to save transfer'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
        return
      }
      const nextMessage = `Transfer saved (ID ${data.id})`
      setSuccess(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      setAmount('')
      setLabel('')
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

      <div className="form-row">
        <div className="form-group">
          <label>From Account</label>
          <select value={fromId} onChange={e => setFromId(e.target.value)} required disabled={loading}>
            <option value="">— from —</option>
            {bootstrap.accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
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
        <label>Label <span className="optional">(optional — e.g. Travel, Emergency)</span></label>
        <input
          type="text"
          placeholder="Label for this savings movement…"
          value={label}
          onChange={e => setLabel(e.target.value)}
          disabled={loading}
        />
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
        className="btn-submit btn-transfer"
        disabled={loading || !date || !fromId || !toId || !amount}
      >
        {loading ? 'Saving…' : 'Save Transfer'}
      </button>
    </form>
  )
}
