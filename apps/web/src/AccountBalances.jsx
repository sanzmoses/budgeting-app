import { useState, useEffect, useMemo } from 'react'
import { getAccountTypeMeta } from './ui'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function fmt(amount) {
  return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function BalanceSection({ title, items, total, emptyMessage }) {
  return (
    <section className="balance-section-card">
      <div className="balance-section-header">
        <div className="balance-section-title">{title}</div>
        <div className={`balance-section-total${total < 0 ? ' balance-amount--negative' : ''}`}>
          PHP {fmt(total)}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="txn-empty balance-section-empty">{emptyMessage}</p>
      ) : (
        <ul className="balance-list">
          {items.map((account) => {
            const typeMeta = getAccountTypeMeta(account.type)

            return (
              <li key={account.id} className="balance-item">
                <div className="balance-name-wrap">
                  <span className="balance-name">{account.name}</span>
                  <span className={`account-type-pill ${typeMeta.className}`}>{typeMeta.label}</span>
                </div>
                <span className={`balance-amount${account.balance < 0 ? ' balance-amount--negative' : ''}`}>
                  {account.currency} {fmt(account.balance)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function AccountBalances({ token, refreshKey }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`${API_BASE_URL}/accounts/balances`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const payload = await r.json()
        if (!r.ok) throw new Error(payload.error || 'Could not load balances')
        setData(payload)
      })
      .catch((err) => setError(err.message || 'Could not load balances'))
      .finally(() => setLoading(false))
  }, [token, refreshKey])

  const grouped = useMemo(() => {
    const balances = data?.balances || []
    const credit = balances.filter((item) => item.type === 'credit')
    const regular = balances.filter((item) => item.type !== 'credit')

    return {
      credit,
      regular,
      creditTotal: credit.reduce((sum, item) => sum + Number(item.balance || 0), 0),
      regularTotal: regular.reduce((sum, item) => sum + Number(item.balance || 0), 0),
    }
  }, [data])

  return (
    <div className="balances-container">
      {loading && <p className="form-loading">Loading balances…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && data && (
        <>
          <div className="balances-grid">
            <BalanceSection
              title="Cash, Checking & Savings"
              items={grouped.regular}
              total={grouped.regularTotal}
              emptyMessage="No non-credit accounts yet."
            />
            <BalanceSection
              title="Credit Accounts"
              items={grouped.credit}
              total={grouped.creditTotal}
              emptyMessage="No credit accounts yet."
            />
          </div>

          <div className="balance-total">
            <span className="balance-total-label">Net Total</span>
            <span className={`balance-total-amount${grouped.regularTotal + grouped.creditTotal < 0 ? ' balance-amount--negative' : ''}`}>
              PHP {fmt(grouped.regularTotal + grouped.creditTotal)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
