import { useMemo, useState } from 'react'
import { useToast } from '../providers/ToastProvider'
import { getAccountTypeMeta } from '../lib/ui'
import { useAccountStore } from '../stores/accountStore'

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

export default function AccountsManager({ onChanged }) {
  const { showToast } = useToast()
  const {
    accounts, loading, error,
    createAccount, updateAccount, deleteAccount,
  } = useAccountStore()

  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(blankForm())
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

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
    setFormError('')
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

      const data = editingId
        ? await updateAccount(editingId, payload)
        : await createAccount(payload)

      const nextMessage = editingId ? `Updated ${data.name}` : `Created ${data.name}`
      setMessage(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      resetForm()
      onChanged?.()
    } catch (err) {
      const nextError = err.message || 'Could not reach the server'
      setFormError(nextError)
      showToast({ tone: 'error', message: nextError })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (deletePhrase !== expectedDeletePhrase) {
      const nextError = 'Delete confirmation phrase does not match'
      setFormError(nextError)
      showToast({ tone: 'warning', message: nextError })
      return
    }

    setDeleteLoading(true)
    clearInlineFeedback()

    try {
      await deleteAccount(deleteTarget.id, deletePhrase)

      const nextMessage = `Deleted ${deleteTarget.name}`
      setMessage(nextMessage)
      showToast({ tone: 'success', message: nextMessage })
      setDeleteTarget(null)
      setDeletePhrase('')
      if (editingId === deleteTarget.id) resetForm()
      onChanged?.()
    } catch (err) {
      const nextError = err.message || 'Could not reach the server'
      setFormError(nextError)
      showToast({ tone: 'error', message: nextError })
    } finally {
      setDeleteLoading(false)
    }
  }

  const displayError = error || formError

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

        {displayError && <p className="form-error">{displayError}</p>}
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
        {!loading && (!accounts || accounts.length === 0) && <p className="txn-empty">No accounts yet.</p>}

        {!loading && accounts && accounts.length > 0 && (
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
