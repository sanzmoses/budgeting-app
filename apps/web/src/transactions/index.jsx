import { useState } from 'react'
import EditTransactionModal from './edit'
import { useToast } from '../providers/ToastProvider'
import { useBootstrapStore } from '../stores/bootstrapStore'
import { useTransactionActions, useTransactionStore } from '../stores/transactionStore'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function fmt(amount) {
  return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function txnLabel(t) {
  if (t.type === 'expense') {
    const parts = [t.category_name, t.subcategory_name].filter(Boolean).join(' › ')
    return parts || t.description || '—'
  }
  if (t.type === 'income') {
    return t.income_source_name || t.description || '—'
  }
  if (t.type === 'transfer') {
    const accounts = [t.from_account_name, t.to_account_name].filter(Boolean).join(' → ')
    return t.transfer_label ? `${t.transfer_label} (${accounts})` : accounts || '—'
  }
  return '—'
}

function txnSub(t) {
  if (t.type === 'expense') {
    const parts = []
    if (t.account_name) parts.push(t.account_name)
    if (t.place_name) parts.push(t.place_name)
    if (t.description) parts.push(t.description)
    return parts.join(' · ') || null
  }
  if (t.type === 'income') {
    const parts = []
    if (t.account_name) parts.push(t.account_name)
    if (t.description) parts.push(t.description)
    return parts.join(' · ') || null
  }
  if (t.type === 'transfer' && t.description) return t.description
  return null
}

export default function TransactionList({ onChanged }) {
  const { showToast } = useToast()
  const { data: bootstrap } = useBootstrapStore()
  const { deleteTransaction } = useTransactionActions()
  const [month, setMonth] = useState(currentMonth())
  const [filterType, setFilterType] = useState('')
  const { data, loading, error, refresh } = useTransactionStore(month, filterType)

  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [editTxn, setEditTxn] = useState(null)

  function reload() {
    refresh()
    onChanged?.()
  }

  async function handleDelete(txn) {
    if (!window.confirm(`Delete this ${txn.type} of ${fmt(txn.amount)}? This cannot be undone.`)) return
    setDeleting(txn.id)
    setDeleteError('')
    try {
      await deleteTransaction(txn.id)
      showToast({ tone: 'success', message: `${txn.type[0].toUpperCase() + txn.type.slice(1)} deleted.` })
      reload()
    } catch (err) {
      const nextError = err.message || 'Failed to delete transaction'
      setDeleteError(nextError)
      showToast({ tone: 'error', message: nextError })
    } finally {
      setDeleting(null)
    }
  }

  function handleEditOpen(txn) {
    setEditTxn(txn)
    showToast({ tone: 'info', message: `Editing ${txn.type}. Update the fields you want to change.` })
  }

  function handleEditSaved(updatedTxn) {
    setEditTxn(null)
    showToast({ tone: 'success', message: `${updatedTxn.type[0].toUpperCase() + updatedTxn.type.slice(1)} updated.` })
    reload()
  }

  const displayError = error || deleteError

  return (
    <div className="txn-list-container">
      <div className="txn-list-filters">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="month-picker"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="type-filter">
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>

      {loading && <p className="form-loading">Loading…</p>}
      {displayError && <p className="form-error">{displayError}</p>}
      {data?.offlineOnly && !loading && (
        <p className="form-error">Showing locally saved transactions while offline.</p>
      )}

      {!loading && data && data.transactions.length === 0 && (
        <p className="txn-empty">No transactions for {month}{filterType ? ` (${filterType})` : ''}.</p>
      )}

      {!loading && data && data.transactions.length > 0 && (
        <>
          <p className="txn-count">
            {data.count} transaction{data.count !== 1 ? 's' : ''}
            {data.offlineOnly ? ' · local only' : ''}
          </p>
          <ul className="txn-list">
            {data.transactions.map(t => (
              <li key={t.id} className={`txn-item txn-item--${t.type}${t.syncStatus ? ' txn-item--pending' : ''}`}>
                <div className="txn-item-left">
                  <span className={`txn-type-badge txn-type-badge--${t.type}`}>{t.type}</span>
                  <div className="txn-item-info">
                    <span className="txn-label">{txnLabel(t)}</span>
                    {txnSub(t) && <span className="txn-sub">{txnSub(t)}</span>}
                    {t.syncStatus && <span className="txn-sync-pill">Pending sync</span>}
                  </div>
                </div>
                <div className="txn-item-right">
                  <span className={`txn-amount txn-amount--${t.type}`}>
                    {t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}
                    {fmt(t.amount)}
                  </span>
                  <span className="txn-date">{t.transaction_date}</span>
                  <div className="txn-actions">
                    <button
                      className="txn-btn-edit"
                      onClick={() => handleEditOpen(t)}
                      disabled={deleting === t.id || !!t.syncStatus}
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      className="txn-btn-delete"
                      onClick={() => handleDelete(t)}
                      disabled={deleting === t.id || !!t.syncStatus}
                      title="Delete"
                    >
                      {deleting === t.id ? '…' : 'Del'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editTxn && bootstrap && (
        <EditTransactionModal
          txn={editTxn}
          onSaved={handleEditSaved}
          onClose={() => setEditTxn(null)}
        />
      )}
    </div>
  )
}
