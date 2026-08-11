import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './contexts/AuthContext'
import { usePlayer } from './contexts/PlayerContext'
import { useState, lazy, Suspense } from 'react'
import { useUserData } from './contexts/UserDataContext'
const Login = lazy(() => import('./pages/Login'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Home = lazy(() => import('./pages/Home'))
const Search = lazy(() => import('./pages/Search'))
const Library = lazy(() => import('./pages/Library'))
const PlaylistView = lazy(() => import('./pages/PlaylistView'))
const ArtistView = lazy(() => import('./pages/ArtistView'))
import BottomNav from './components/BottomNav'
import MiniPlayer from './components/MiniPlayer'
import NowPlaying from './components/NowPlaying'
import Toast from './components/Toast'

function App() {
  const { user, loading } = useAuth()
  const { dataLoaded, hasOnboarded } = useUserData()
  const { currentTrack } = usePlayer()
  const [showNowPlaying, setShowNowPlaying] = useState(false)

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-surface-500">
        <div className="text-4xl font-black text-gradient animate-pulse">Shadow Music</div>
        <div className="mt-4 text-sm text-white/40">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Suspense fallback={
        <div className="h-full w-full flex flex-col items-center justify-center bg-surface-500">
          <div className="text-4xl font-black text-gradient animate-pulse">Shadow Music</div>
        </div>
      }>
        <Login />
      </Suspense>
    )
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Onboarding Overlay */}
      {dataLoaded && !hasOnboarded && (
        <Suspense fallback={null}>
          <AnimatePresence>
            <Onboarding />
          </AnimatePresence>
        </Suspense>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar relative" 
           style={{ paddingBottom: currentTrack ? '160px' : '90px' }}>
        <AnimatedRoutes />
      </div>

      {/* Mini Player */}
      {currentTrack && (
        <MiniPlayer onExpand={() => setShowNowPlaying(true)} />
      )}

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Now Playing Overlay */}
      {showNowPlaying && (
        <NowPlaying onClose={() => setShowNowPlaying(false)} />
      )}

      {/* Toast Notifications */}
      <Toast />
    </div>
  )
}

export default App

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <Suspense fallback={
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-brand-300 animate-pulse text-sm font-medium tracking-widest uppercase">Loading...</div>
      </div>
    }>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/home" element={<PageWrap><Home /></PageWrap>} />
          <Route path="/search" element={<PageWrap><Search /></PageWrap>} />
          <Route path="/library" element={<PageWrap><Library /></PageWrap>} />
          <Route path="/playlist/:id" element={<PageWrap><PlaylistView /></PageWrap>} />
          <Route path="/artist/:id" element={<PageWrap><ArtistView /></PageWrap>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  )
}

function PageWrap({ children }) {
  return (
    <motion.div
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -24, opacity: 0 }}
      transition={{ type: 'tween', ease: 'easeOut', duration: 0.22 }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  )
}
