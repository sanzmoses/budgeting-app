import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

let nextToastId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((input) => {
    const toast = typeof input === 'string'
      ? { message: input, tone: 'info' }
      : input

    const id = nextToastId++
    const duration = toast.duration ?? 3200

    setToasts((prev) => [...prev, { ...toast, id }])

    const timer = setTimeout(() => {
      timersRef.current.delete(id)
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, duration)

    timersRef.current.set(id, timer)
    return id
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone || 'info'}`} role="status">
            <div className="toast-body">
              <div className="toast-title">{toast.title || defaultTitle(toast.tone)}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function defaultTitle(tone) {
  switch (tone) {
    case 'success': return 'Success'
    case 'error': return 'Error'
    case 'warning': return 'Warning'
    default: return 'Info'
  }
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used within ToastProvider')
  return value
}
