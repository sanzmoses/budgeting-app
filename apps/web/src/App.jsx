import { useState, useEffect } from 'react'
import LoginForm from './LoginForm'
import AppShell  from './AppShell'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TOKEN_KEY    = 'budget_token'
const USER_KEY     = 'budget_user'
const THEME_KEY    = 'budget_theme'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  const [checking, setChecking] = useState(!!localStorage.getItem(TOKEN_KEY))

  // Default to dark mode; honour stored preference on subsequent visits
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return stored ? stored === 'dark' : true
  })

  // Apply data-theme to <html> so CSS variables pick it up globally
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Verify stored token is still valid server-side on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) return

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('invalid')
        return res.json()
      })
      .then((data) => {
        setUser(data)
        localStorage.setItem(USER_KEY, JSON.stringify(data))
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => setChecking(false))
  }, [])

  function handleLogin(newToken, newUser) {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  function toggleDarkMode() {
    setDarkMode(d => !d)
  }

  if (checking) return null

  if (!token || !user) {
    return <LoginForm onLogin={handleLogin} />
  }

  return (
    <AppShell
      user={user}
      token={token}
      onLogout={handleLogout}
      darkMode={darkMode}
      toggleDarkMode={toggleDarkMode}
    />
  )
}

export default App
