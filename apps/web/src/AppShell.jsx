import { useState, useEffect, useRef } from 'react'
import { getBootstrapCache, getLastBootstrapSyncAt, saveBootstrapCache } from './offlineDb'
import { useNetworkStatus } from './useNetworkStatus'
import { useOfflineSync } from './useOfflineSync'
import {
  PlusCircle,
  TrendingUp,
  ArrowLeftRight,
  List,
  Wallet,
  BarChart2,
  Settings,
  MoreHorizontal,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import ExpenseForm from './ExpenseForm'
import IncomeForm from './IncomeForm'
import TransferForm from './TransferForm'
import TransactionList from './TransactionList'
import AccountBalances from './AccountBalances'
import BudgetManager from './BudgetManager'
import AccountsManager from './AccountsManager'
import SubcategoriesManager from './SubcategoriesManager'
import ReportsPage from './ReportsPage'
import logoUrl from './assets/logo-budgeting-app.svg'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const NAV_ITEMS = [
  { id: 'expense', label: 'Expense', icon: PlusCircle },
  { id: 'income', label: 'Income', icon: TrendingUp },
  { id: 'savings', label: 'Savings', icon: ArrowLeftRight },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
  { id: 'balances', label: 'Balances', icon: Wallet },
  { id: 'budgets', label: 'Budgets', icon: BarChart2 },
  { id: 'accounts', label: 'Accounts', icon: Settings },
  { id: 'subcategories', label: 'Subcategories', icon: Settings },
]

const BOTTOM_PRIMARY = NAV_ITEMS.slice(0, 4)
const BOTTOM_OVERFLOW = NAV_ITEMS.slice(4)

export default function AppShell({ user, token, onLogout, darkMode, toggleDarkMode }) {
  const [activeTab, setActiveTab] = useState('reports')
  const [bootstrap, setBootstrap] = useState(null)
  const [bootstrapErr, setBootstrapErr] = useState('')
  const [bootstrapMeta, setBootstrapMeta] = useState({ source: 'network', syncedAt: null })
  const [refreshKey, setRefreshKey] = useState(0)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const isOnline = useNetworkStatus()
  const [syncRefreshKey, setSyncRefreshKey] = useState(0)
  const { pending, syncing, failed } = useOfflineSync({
    token,
    enabled: isOnline,
    refreshKey: syncRefreshKey,
    onSyncComplete: (result) => {
      if (result?.synced) {
        setRefreshKey(k => k + 1)
      }
      setSyncRefreshKey(k => k + 1)
    },
  })

  const avatarRef = useRef(null)
  const moreRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadBootstrap() {
      setBootstrapErr('')

      try {
        const response = await fetch(`${API_BASE_URL}/bootstrap`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error('bootstrap_request_failed')
        }

        const data = await response.json()
        const syncedAt = await saveBootstrapCache(data)

        if (cancelled) return

        setBootstrap(data)
        setBootstrapMeta({ source: 'network', syncedAt })
        return
      } catch {
        const cached = await getBootstrapCache()
        const cachedSyncedAt = await getLastBootstrapSyncAt()

        if (!cancelled && cached?.payload) {
          setBootstrap(cached.payload)
          setBootstrapMeta({ source: 'cache', syncedAt: cached.syncedAt || cachedSyncedAt })
          setBootstrapErr('Using cached form options while offline or while the API is unavailable.')
          return
        }

        if (!cancelled) {
          setBootstrap(null)
          setBootstrapMeta({ source: 'network', syncedAt: null })
          setBootstrapErr('Could not load form options. Is the API running?')
        }
      }
    }

    loadBootstrap()

    return () => {
      cancelled = true
    }
  }, [token, refreshKey])

  useEffect(() => {
    function onOutsideClick(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  async function handleLogout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // Ignore network errors; clear local state regardless
    }
    onLogout()
  }

  function handleDataChanged() {
    setRefreshKey(k => k + 1)
    setSyncRefreshKey(k => k + 1)
  }

  function navigate(tabId) {
    setActiveTab(tabId)
    setMoreOpen(false)
  }

  const activeItem = NAV_ITEMS.find(n => n.id === activeTab)
  const userInitial = (user.name || user.username || '?')[0].toUpperCase()
  const overflowActive = BOTTOM_OVERFLOW.some(i => i.id === activeTab)
  const shortSyncedAt = bootstrapMeta.syncedAt
    ? new Date(bootstrapMeta.syncedAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
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
          <span>{activeItem?.label}</span>
          <span className={`shell-sync-status shell-sync-status--${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'Online' : 'Offline'}
            {bootstrapMeta.source === 'cache' ? ' · cached data' : ''}
            {syncing > 0 ? ` · syncing: ${syncing}` : ''}
            {pending > 0 ? ` · pending sync: ${pending}` : ''}
            {failed > 0 ? ` · failed sync: ${failed}` : ''}
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
                <div className="avatar-dropdown-name">
                  {user.name || user.username}
                </div>
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
              <ExpenseForm token={token} bootstrap={bootstrap} onCreated={handleDataChanged} />
            </section>
          )}

          {activeTab === 'income' && (
            <section className="form-card">
              <h2 className="section-title">New Income</h2>
              <IncomeForm token={token} bootstrap={bootstrap} onCreated={handleDataChanged} />
            </section>
          )}

          {activeTab === 'savings' && (
            <section className="form-card">
              <h2 className="section-title">New Savings Transfer</h2>
              <TransferForm token={token} bootstrap={bootstrap} onCreated={handleDataChanged} />
            </section>
          )}

          {activeTab === 'transactions' && (
            <section className="form-card">
              <h2 className="section-title">Transactions</h2>
              <TransactionList
                token={token}
                bootstrap={bootstrap}
                refreshKey={refreshKey}
                onChanged={handleDataChanged}
              />
            </section>
          )}

          {activeTab === 'balances' && (
            <section className="form-card form-card--wide">
              <h2 className="section-title">Account Balances</h2>
              <AccountBalances token={token} refreshKey={refreshKey} />
            </section>
          )}

          {activeTab === 'reports' && (
            <section className="form-card form-card--wide form-card--reports form-card--reports-dashboard">
              <ReportsPage token={token} onAddExpense={() => setActiveTab('expense')} />
            </section>
          )}

          {activeTab === 'budgets' && (
            <section className="form-card form-card--wide">
              <h2 className="section-title">Monthly Budgets</h2>
              <BudgetManager
                token={token}
                bootstrap={bootstrap}
                refreshKey={refreshKey}
                onChanged={handleDataChanged}
              />
            </section>
          )}

          {activeTab === 'accounts' && (
            <section className="form-card form-card--wide">
              <h2 className="section-title">Accounts</h2>
              <AccountsManager
                token={token}
                refreshKey={refreshKey}
                onChanged={handleDataChanged}
              />
            </section>
          )}

          {activeTab === 'subcategories' && (
            <section className="form-card form-card--wide">
              <h2 className="section-title">Subcategories</h2>
              <SubcategoriesManager
                token={token}
                refreshKey={refreshKey}
                onChanged={handleDataChanged}
              />
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
