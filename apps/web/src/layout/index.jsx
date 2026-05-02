import { useState, useEffect, useRef } from 'react'
import { useBootstrapStore } from '../stores/bootstrapStore'
import { useStoreActions } from '../stores'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { authService } from '../services/authService'
import {
  PlusCircle, TrendingUp, ArrowLeftRight, List, Wallet,
  BarChart2, Settings, MoreHorizontal, Moon, Sun, LogOut, ChevronRight,
} from 'lucide-react'
import ExpenseForm from '../transactions/forms/ExpenseForm'
import IncomeForm from '../transactions/forms/IncomeForm'
import TransferForm from '../transactions/forms/TransferForm'
import TransactionList from '../transactions'
import AccountBalances from '../accounts/components/Balances'
import BudgetManager from '../budgets'
import AccountsManager from '../accounts'
import SubcategoriesManager from '../settings/subcategories'
import ReportsPage from '../reports'
import logoUrl from '../assets/logo-budgeting-app.svg'

const NAV_ITEMS = [
  { id: 'expense',       label: 'Expense',       icon: PlusCircle },
  { id: 'income',        label: 'Income',        icon: TrendingUp },
  { id: 'savings',       label: 'Savings',       icon: ArrowLeftRight },
  { id: 'transactions',  label: 'Transactions',  icon: List },
  { id: 'reports',       label: 'Reports',       icon: BarChart2 },
  { id: 'balances',      label: 'Balances',      icon: Wallet },
  { id: 'budgets',       label: 'Budgets',       icon: BarChart2 },
  { id: 'accounts',      label: 'Accounts',      icon: Settings },
  { id: 'subcategories', label: 'Subcategories', icon: Settings },
]

const BOTTOM_PRIMARY  = NAV_ITEMS.slice(0, 4)
const BOTTOM_OVERFLOW = NAV_ITEMS.slice(4)

export default function AppShell({ user, onLogout, darkMode, toggleDarkMode }) {
  const [activeTab, setActiveTab] = useState('reports')
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [syncRefreshKey, setSyncRefreshKey] = useState(0)

  const { error: bootstrapErr, source: bootstrapSource, syncedAt } = useBootstrapStore()
  const {
    invalidateBootstrap,
    invalidateBudgets,
    invalidateTransactions,
    invalidateAccounts,
    invalidateReports,
    invalidateSubcategories,
  } = useStoreActions()

  const isOnline = useNetworkStatus()
  const { pending, syncing, failed } = useOfflineSync({
    enabled: isOnline,
    refreshKey: syncRefreshKey,
    onSyncComplete: (result) => {
      if (result?.synced) handleDataChanged()
      setSyncRefreshKey(k => k + 1)
    },
  })

  const avatarRef = useRef(null)
  const moreRef   = useRef(null)

  useEffect(() => {
    function onOutsideClick(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
      if (moreRef.current  && !moreRef.current.contains(e.target))  setMoreOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  async function handleLogout() {
    try { await authService.logout() } catch { /* ignore network errors */ }
    onLogout()
  }

  function handleDataChanged() {
    invalidateBootstrap()
    invalidateBudgets()
    invalidateTransactions()
    invalidateAccounts()
    invalidateReports()
    invalidateSubcategories()
    setSyncRefreshKey(k => k + 1)
  }

  function navigate(tabId) {
    setActiveTab(tabId)
    setMoreOpen(false)
  }

  const activeItem     = NAV_ITEMS.find(n => n.id === activeTab)
  const userInitial    = (user.name || user.username || '?')[0].toUpperCase()
  const overflowActive = BOTTOM_OVERFLOW.some(i => i.id === activeTab)
  const shortSyncedAt  = syncedAt
    ? new Date(syncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-left">
          <img src={logoUrl} alt="Budgeting App logo" className="shell-logo-mark" />
          <div className="shell-logo-lockup">
            <span className="shell-logo">Budget</span>
            <span className="shell-logo-dot">.</span>
          </div>
        </div>

        <div className="shell-header-center shell-breadcrumb shell-header-center--stacked">
          <span className="shell-page-title">{activeItem?.label}</span>
          <span className={`shell-sync-status shell-sync-status--${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'Online' : 'Offline'}
            {bootstrapSource === 'cache' ? ' · cached data' : ''}
            {syncing > 0 ? ` · syncing: ${syncing}` : ''}
            {pending > 0 ? ` · pending sync: ${pending}` : ''}
            {failed  > 0 ? ` · failed sync: ${failed}`  : ''}
            {shortSyncedAt ? ` · ${shortSyncedAt}` : ''}
          </span>
        </div>

        <div className="shell-header-right">
          <div className="avatar-wrap" ref={avatarRef}>
            <button
              className="avatar-btn"
              onClick={() => setAvatarOpen(o => !o)}
              aria-label="User menu"
              aria-expanded={avatarOpen}
            >
              {userInitial}
            </button>

            {avatarOpen && (
              <div className="avatar-dropdown" role="menu">
                <div className="avatar-dropdown-name">{user.name || user.username}</div>
                <button
                  className="avatar-dropdown-item"
                  role="menuitem"
                  onClick={() => { toggleDarkMode(); setAvatarOpen(false) }}
                >
                  {darkMode ? <Sun size={14} /> : <Moon size={14} />}
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <div className="avatar-dropdown-divider" />
                <button
                  className="avatar-dropdown-item avatar-dropdown-logout"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="shell-body">
        <aside className="shell-sidebar">
          <nav className="sidebar-nav" aria-label="Main navigation">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`sidebar-nav-item${activeTab === item.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="shell-main">
          {bootstrapErr && <p className="form-error" style={{ marginBottom: 16 }}>{bootstrapErr}</p>}

          {activeTab === 'expense' && (
            <section className="form-card">
              <h2 className="section-title">New Expense</h2>
              <ExpenseForm onCreated={handleDataChanged} />
            </section>
          )}

          {activeTab === 'income' && (
            <section className="form-card">
              <h2 className="section-title">New Income</h2>
              <IncomeForm onCreated={handleDataChanged} />
            </section>
          )}

          {activeTab === 'savings' && (
            <section className="form-card">
              <h2 className="section-title">New Savings Transfer</h2>
              <TransferForm onCreated={handleDataChanged} />
            </section>
          )}

          {activeTab === 'transactions' && (
            <section className="form-card">
              <h2 className="section-title">Transactions</h2>
              <TransactionList onChanged={handleDataChanged} />
            </section>
          )}

          {activeTab === 'balances' && (
            <section className="form-card form-card--wide">
              <h2 className="section-title">Account Balances</h2>
              <AccountBalances />
            </section>
          )}

          {activeTab === 'reports' && (
            <ReportsPage onAddExpense={() => setActiveTab('expense')} />
          )}

          {activeTab === 'budgets' && (
            <section className="form-card form-card--wide">
              <h2 className="section-title">Monthly Budgets</h2>
              <BudgetManager onChanged={handleDataChanged} />
            </section>
          )}

          {activeTab === 'accounts' && (
            <section className="form-card form-card--wide">
              <h2 className="section-title">Accounts</h2>
              <AccountsManager onChanged={handleDataChanged} />
            </section>
          )}

          {activeTab === 'subcategories' && (
            <section className="form-card form-card--wide">
              <h2 className="section-title">Subcategories</h2>
              <SubcategoriesManager onChanged={handleDataChanged} />
            </section>
          )}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {BOTTOM_PRIMARY.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`bottom-nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          )
        })}

        <div className="bottom-nav-more-wrap" ref={moreRef}>
          <button
            className={`bottom-nav-item${overflowActive ? ' active' : ''}`}
            onClick={() => setMoreOpen(o => !o)}
            aria-label="More"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={16} />
            <span>More</span>
          </button>

          {moreOpen && (
            <div className="more-popup" role="menu">
              {BOTTOM_OVERFLOW.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    className={`more-popup-item${activeTab === item.id ? ' active' : ''}`}
                    onClick={() => navigate(item.id)}
                    role="menuitem"
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                    <ChevronRight size={14} className="more-popup-arrow" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
