import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { PlayerProvider } from './contexts/PlayerContext'
import { UserDataProvider } from './contexts/UserDataContext'
import { DownloadProvider } from './contexts/DownloadContext'
import { MusicDataProvider } from './contexts/MusicDataContext'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import './index.css'

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#050505' }).catch(() => {})
}

// Prevent unhandled network disconnect errors or rejection from crashing the app
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Prevented crash from unhandled promise rejection (offline/network):', event.reason)
  event.preventDefault()
})

window.addEventListener('error', (event) => {
  console.warn('Prevented crash from window error (offline/network):', event.error)
})

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-[#050505] p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-white/50 mb-6">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }} 
            className="px-6 py-2.5 rounded-full bg-brand-300 text-black font-semibold press-scale"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <UserDataProvider>
              <MusicDataProvider>
                <DownloadProvider>
                  <PlayerProvider>
                    <App />
                  </PlayerProvider>
                </DownloadProvider>
              </MusicDataProvider>
            </UserDataProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
