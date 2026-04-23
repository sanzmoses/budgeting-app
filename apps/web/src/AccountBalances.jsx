import { useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function fmt(amount) {
  return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function AccountBalances({ token, refreshKey }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`${API_BASE_URL}/accounts/balances`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Could not load balances'))
      .finally(() => setLoading(false))
  }, [token, refreshKey])

  const total = data
    ? data.balances.reduce((sum, b) => sum + b.balance, 0)
    : 0

  return (
    <div className="balances-container">
      {loading && <p className="form-loading">Loading balances…</p>}
      {error   && <p className="form-error">{error}</p>}

      {!loading && data && (
        <>
          <ul className="balance-list">
            {data.balances.map(b => (
              <li key={b.id} className="balance-item">
                <span className="balance-name">{b.name}</span>
                <span className={`balance-amount${b.balance < 0 ? ' balance-amount--negative' : ''}`}>
                  {b.currency} {fmt(b.balance)}
                </span>
              </li>
            ))}
          </ul>
          <div className="balance-total">
            <span className="balance-total-label">Total</span>
            <span className={`balance-total-amount${total < 0 ? ' balance-amount--negative' : ''}`}>
              {fmt(total)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
