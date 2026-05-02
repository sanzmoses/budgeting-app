import { useState, useEffect } from 'react'
import LoginForm from '../login'
import AppShell from '../layout'
import { ToastProvider } from '../providers/ToastProvider'
import { StoreProvider } from '../stores'
import { apiClient } from '../lib/apiClient'
import { authService } from '../services/authService'
import './index.css'

const TOKEN_KEY = 'budget_token'
const USER_KEY  = 'budget_user'
const THEME_KEY = 'budget_theme'

function App() {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) apiClient.setToken(stored)
    return stored
  })
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  const [checking, setChecking] = useState(!!localStorage.getItem(TOKEN_KEY))

  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return stored ? stored === 'dark' : true
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) return

    apiClient.setToken(stored)

    authService.me()
      .then((data) => {
        setUser(data)
        localStorage.setItem(USER_KEY, JSON.stringify(data))
      })
      .catch(() => {
        apiClient.clearToken()
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => setChecking(false))
  }, [])

  function handleLogin(newToken, newUser) {
    apiClient.setToken(newToken)
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  function handleLogout() {
    apiClient.clearToken()
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
    <ToastProvider>
      <StoreProvider>
        <AppShell
          user={user}
          onLogout={handleLogout}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      </StoreProvider>
    </ToastProvider>
  )
}

export default App
