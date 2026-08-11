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
  StatusBar.setStyle({ style: Style.Dark })
  StatusBar.setBackgroundColor({ color: '#050505' })
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>
)
