import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = useCallback((message) => {
    setToastMessage(message)
  }, [])

  const hideToast = useCallback(() => {
    setToastMessage(null)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, hideToast, toastMessage }}>
      {children}
    </ToastContext.Provider>
  )
}
