import { useState, useEffect } from 'react'
import EditTransactionModal from './EditTransactionModal'
import { useToast } from './ToastProvider'
import { getOfflineTransactionsByMonth } from './offlineTransactions'
import { toOfflineTransactionView } from './offlineTxnView'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
  if (t.type === 'transfer' && t.description) {
    return t.description
  }
  return null
}

export default function TransactionList({ token, bootstrap, refreshKey, onChanged }) {
  const { showToast } = useToast()
  const [month, setMonth] = useState(currentMonth())
  const [filterType, setFilterType] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [editTxn, setEditTxn] = useState(null)
  const [listKey, setListKey] = useState(0)

  function reload() {
    setListKey(k => k + 1)
    onChanged?.()
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ month })
    if (filterType) params.set('type', filterType)

    fetch(`${API_BASE_URL}/transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const payload = await r.json()
        if (!r.ok) throw new Error(payload.error || 'Could not load transactions')
        setData(payload)
      })
      .catch(async (err) => {
        const offlineRows = await getOfflineTransactionsByMonth(month, filterType)

        if (offlineRows.length > 0) {
          setData({
            transactions: offlineRows.map(row => toOfflineTransactionView(row, bootstrap)),
            count: offlineRows.length,
            offlineOnly: true,
          })
          setError('Showing locally saved transactions while offline.')
          showToast({ tone: 'warning', message: 'Showing locally saved transactions while offline.' })
          return
        }

        const nextError = err.message || 'Could not load transactions'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
      })
      .finally(() => setLoading(false))
  }, [token, month, filterType, refreshKey, listKey])

  async function handleDelete(txn) {
    if (!window.confirm(`Delete this ${txn.type} of ${fmt(txn.amount)}? This cannot be undone.`)) return
    setDeleting(txn.id)
    try {
      const res = await fetch(`${API_BASE_URL}/transactions/${txn.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok || res.status === 204) {
        showToast({ tone: 'success', message: `${txn.type[0].toUpperCase() + txn.type.slice(1)} deleted.` })
        reload()
      } else {
        const d = await res.json().catch(() => ({}))
        const nextError = d.error || 'Failed to delete transaction'
        setError(nextError)
        showToast({ tone: 'error', message: nextError })
      }
    } catch {
      const nextError = 'Could not reach the server'
      setError(nextError)
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
      {error && <p className="form-error">{error}</p>}

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
          bootstrap={bootstrap}
          token={token}
          onSaved={handleEditSaved}
          onClose={() => setEditTxn(null)}
        />
      )}
    </div>
  )
}
