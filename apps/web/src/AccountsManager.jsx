import { useEffect, useMemo, useState } from 'react'
import { useToast } from './ToastProvider'
import { getAccountTypeMeta } from './ui'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'credit']

function blankForm() {
  return {
    name: '',
    type: 'checking',
    opening_balance: '0.00',
    currency: 'PHP',
    is_active: true,
    sort_order: '0',
  }
}

function fmt(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function AccountsManager({ token, refreshKey, onChanged }) {
  const { showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(blankForm())
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    loadAccounts()
  }, [token, refreshKey])

  async function loadAccounts() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to load accounts')
      setAccounts(payload.accounts || [])
    } catch (err) {
      const nextError = err.message || 'Could not load accounts'
      setError(nextError)
      showToast({ tone: 'error', message: nextError })
    } finally {
      setLoading(false)
    }
  }

  const expectedDeletePhrase = useMemo(() => {
    if (!deleteTarget) return ''
    return `delete ${deleteTarget.name}`
  }, [deleteTarget])

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setForm(blankForm())
    setEditingId(null)
  }

  function clearInlineFeedback() {
    setError('')
    setMessage('')
  }

  function startEdit(account) {
    setEditingId(account.id)
    setForm({
      name: account.name,
      type: account.type,
      opening_balance: String(account.opening_balance),
      currency: account.currency,
      is_active: Boolean(account.is_active),
      sort_order: String(account.sort_order ?? 0),
    })
    clearInlineFeedback()
    showToast({ tone: 'info', message: `Check fields to update for ${account.name}.` })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    clearInlineFeedback()

    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        opening_balance: Number(form.opening_balance),
        currency: form.currency.trim().toUpperCase(),
        is_active: form.is_active,
        sort_order: Number(form.sort_order || 0),
      }

      const url = editingId ? `${API_BASE_URL}/accounts/${editingId}` : `${API_BASE_URL}/accounts`
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        const nextError = data.error || 'Failed to save account'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
        return
      }

      const nextMessage = editingId ? `Updated ${data.name}` : `Created ${data.name}`
      setMessage(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      resetForm()
      await loadAccounts()
      onChanged?.()
    } catch {
      setError('Could not reach the server')
      showToast({ tone: 'error', message: 'Could not reach the server' })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (deletePhrase !== expectedDeletePhrase) {
      const nextError = 'Delete confirmation phrase does not match'
      setError(nextError)
      showToast({ tone: 'warning', message: nextError })
      return
    }

    setDeleteLoading(true)
    clearInlineFeedback()

    try {
      const res = await fetch(`${API_BASE_URL}/accounts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = res.status === 204 ? null : await res.json()
      if (!res.ok) {
        const nextError = payload?.error || 'Failed to delete account'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
        return
      }

      const nextMessage = `Deleted ${deleteTarget.name}`
      setMessage(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      setDeleteTarget(null)
      setDeletePhrase('')
      if (editingId === deleteTarget.id) resetForm()
      await loadAccounts()
      onChanged?.()
    } catch {
      setError('Could not reach the server')
      showToast({ tone: 'error', message: 'Could not reach the server' })
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="settings-manager">
      <form className="txn-form settings-form" onSubmit={handleSubmit}>
        <div className="settings-form-header">
          <div>
            <div className="settings-section-title">{editingId ? 'Edit Account' : 'New Account'}</div>
            <div className="budget-meta">Manage account configuration used by transactions and balances.</div>
          </div>
        </div>

        <div className="form-group">
          <label>Account Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            placeholder="e.g. BPI Main"
            required
            disabled={saving}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={(e) => updateForm('type', e.target.value)} disabled={saving}>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Currency</label>
            <input
              type="text"
              maxLength="3"
              value={form.currency}
              onChange={(e) => updateForm('currency', e.target.value.toUpperCase())}
              placeholder="PHP"
              required
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Opening Balance</label>
            <input
              type="number"
              step="0.01"
              value={form.opening_balance}
              onChange={(e) => updateForm('opening_balance', e.target.value)}
              required
              disabled={saving}
            />
          </div>
          <div className="form-group">
            <label>Sort Order</label>
            <input
              type="number"
              step="1"
              value={form.sort_order}
              onChange={(e) => updateForm('sort_order', e.target.value)}
              required
              disabled={saving}
            />
          </div>
        </div>

        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => updateForm('is_active', e.target.checked)}
            disabled={saving}
          />
          <span>Account is active</span>
        </label>

        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}

        <div className="modal-actions settings-actions">
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
              Cancel Edit
            </button>
          )}
          <button type="submit" className="btn-submit" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update Account' : 'Create Account'}
          </button>
        </div>
      </form>

      <div className="settings-list-wrap">
        <div className="settings-section-title">Accounts</div>
        {loading && <p className="form-loading">Loading accounts…</p>}
        {!loading && accounts.length === 0 && <p className="txn-empty">No accounts yet.</p>}

        {!loading && accounts.length > 0 && (
          <div className="settings-list">
            {accounts.map((account) => {
              const typeMeta = getAccountTypeMeta(account.type)

              return (
                <div key={account.id} className="settings-item">
                  <div className="settings-item-main">
                    <div className="settings-item-title-row">
                      <div className="settings-item-title">{account.name}</div>
                      <span className={`account-type-pill ${typeMeta.className}`}>
                        {typeMeta.label}
                      </span>
                      {!account.is_active && <span className="txn-type-badge">inactive</span>}
                    </div>
                    <div className="settings-item-meta">
                      {account.currency} · Opening: {fmt(account.opening_balance)} · Balance: {fmt(account.balance)}
                    </div>
                    <div className="settings-item-meta">Sort order: {account.sort_order}</div>
                  </div>
                  <div className="txn-actions settings-item-actions">
                    <button type="button" className="txn-btn-edit" onClick={() => startEdit(account)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="txn-btn-delete"
                      onClick={() => {
                        setDeleteTarget(account)
                        setDeletePhrase('')
                        clearInlineFeedback()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleteLoading && setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Account Deletion</h2>
              <button className="modal-close" onClick={() => !deleteLoading && setDeleteTarget(null)} aria-label="Close">
                ×
              </button>
            </div>

            <p className="delete-warning-text">
              This will permanently delete <strong>{deleteTarget.name}</strong> and all transactions that reference it.
              Balances and budget aggregates will recalculate from the remaining data.
            </p>

            <div className="form-group">
              <label>Type this exact phrase to confirm</label>
              <input
                type="text"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                placeholder={expectedDeletePhrase}
                disabled={deleteLoading}
              />
            </div>

            <div className="budget-meta">Expected: {expectedDeletePhrase}</div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit delete-confirm-btn"
                onClick={confirmDelete}
                disabled={deleteLoading || deletePhrase !== expectedDeletePhrase}
              >
                {deleteLoading ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
