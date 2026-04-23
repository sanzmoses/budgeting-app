import { useState, useEffect } from 'react'
import ExpenseForm      from './ExpenseForm'
import IncomeForm       from './IncomeForm'
import TransferForm     from './TransferForm'
import TransactionList  from './TransactionList'
import AccountBalances  from './AccountBalances'
import BudgetManager    from './BudgetManager'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const TABS = [
  { id: 'expense',      label: 'Expense'      },
  { id: 'income',       label: 'Income'       },
  { id: 'savings',      label: 'Savings'      },
  { id: 'transactions', label: 'Transactions' },
  { id: 'balances',     label: 'Balances'     },
  { id: 'budgets',      label: 'Budgets'      },
]

export default function AppShell({ user, token, onLogout }) {
  const [activeTab, setActiveTab]       = useState('expense')
  const [bootstrap, setBootstrap]       = useState(null)
  const [bootstrapErr, setBootstrapErr] = useState('')
  const [refreshKey, setRefreshKey]     = useState(0)

  useEffect(() => {
    fetch(`${API_BASE_URL}/bootstrap`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setBootstrap(data))
      .catch(() => setBootstrapErr('Could not load form options. Is the API running?'))
  }, [token])

  async function handleLogout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // Ignore network errors — clear local state regardless
    }
    onLogout()
  }

  // Called after any create/edit/delete so balances and lists stay in sync
  function handleDataChanged() {
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Budgeting App</h1>
        <span className="phase-badge">Phase 5</span>
        <div className="user-bar">
          <span className="user-name">{user.name}</span>
          <button className="logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {bootstrapErr && <p className="form-error">{bootstrapErr}</p>}

        {activeTab === 'expense' && (
          <section className="form-card">
            <h2>New Expense</h2>
            <ExpenseForm token={token} bootstrap={bootstrap} onCreated={handleDataChanged} />
          </section>
        )}

        {activeTab === 'income' && (
          <section className="form-card">
            <h2>New Income</h2>
            <IncomeForm token={token} bootstrap={bootstrap} onCreated={handleDataChanged} />
          </section>
        )}

        {activeTab === 'savings' && (
          <section className="form-card">
            <h2>New Savings Transfer</h2>
            <TransferForm token={token} bootstrap={bootstrap} onCreated={handleDataChanged} />
          </section>
        )}

        {activeTab === 'transactions' && (
          <section className="form-card">
            <h2>Transactions</h2>
            <TransactionList
              token={token}
              bootstrap={bootstrap}
              refreshKey={refreshKey}
              onChanged={handleDataChanged}
            />
          </section>
        )}

        {activeTab === 'balances' && (
          <section className="form-card">
            <h2>Account Balances</h2>
            <AccountBalances token={token} refreshKey={refreshKey} />
          </section>
        )}

        {activeTab === 'budgets' && (
          <section className="form-card">
            <h2>Monthly Budgets</h2>
            <BudgetManager
              token={token}
              bootstrap={bootstrap}
              refreshKey={refreshKey}
              onChanged={handleDataChanged}
            />
          </section>
        )}
      </main>
    </div>
  )
}
