import { useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export default function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res  = await fetch(`${API_BASE_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      onLogin(data.token, data.user)
    } catch {
      setError('Could not reach the server. Is the API running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">

      {/* Header — always visible */}
      <header className="login-header">
        <span className="shell-logo">Budget</span>
        <span className="shell-logo-dot">.</span>
      </header>

      <div className="login-body">

        {/* Sidebar — desktop only */}
        <aside className="login-sidebar">
          <div className="login-sidebar-content">
            <h2 className="login-sidebar-title">Personal Finance Tracker</h2>
            <p className="login-sidebar-sub">
              Track expenses, income, and savings in one clear dashboard.
            </p>
            <ul className="login-feature-list">
              <li>Expense &amp; income logging</li>
              <li>Monthly budget management</li>
              <li>Account balance overview</li>
              <li>Savings transfer tracking</li>
            </ul>
          </div>
        </aside>

        {/* Login form */}
        <main className="login-main">
          <form className="login-form" onSubmit={handleSubmit}>
            <h1>Sign in</h1>
            <p className="login-form-sub">Enter your credentials to continue</p>

            <div className="form-group">
              <label htmlFor="lf-username">Username</label>
              <input
                id="lf-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                disabled={loading}
                placeholder="your username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="lf-password">Password</label>
              <input
                id="lf-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              type="submit"
              className="btn-submit"
              disabled={loading || !username || !password}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </main>
      </div>
    </div>
  )
}
