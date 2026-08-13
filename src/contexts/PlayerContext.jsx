import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useToast } from './ToastContext'
import { useUserData } from './UserDataContext'
import { useDownload } from './DownloadContext'
import { useMusicData } from './MusicDataContext'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { MediaSession } from '@jofr/capacitor-media-session'

// --- Three separate contexts ---
const PlayerCoreContext = createContext()
const PlayerProgressContext = createContext()
const PlayerQueueContext = createContext()

// --- Three separate hooks ---
export function usePlayerCore() {
  return useContext(PlayerCoreContext)
}

export function usePlayerProgress() {
  return useContext(PlayerProgressContext)
}

export function usePlayerQueue() {
  return useContext(PlayerQueueContext)
}

// Legacy hook — returns all three merged (for gradual migration)
export function usePlayer() {
  const core = useContext(PlayerCoreContext)
  const progress = useContext(PlayerProgressContext)
  const queue = useContext(PlayerQueueContext)
  return { ...core, ...progress, ...queue }
}

// --- Single Provider that wraps all three ---
export function PlayerProvider({ children }) {
  const { showToast } = useToast()
  const { addToHistory } = useUserData()
  const { downloadedSongs, isReady: isDownloadReady } = useDownload()
  const { songs: allTracks } = useMusicData()
  
  const audio1Ref = useRef(new Audio())
  const audio2Ref = useRef(new Audio())
  const isCrossfading = useRef(false)
  
  const [activeAudioIndex, setActiveAudioIndex] = useState(1)
  
  const [currentTrack, setCurrentTrack] = useState(() => {
    try { return JSON.parse(localStorage.getItem('currentTrack')) || null } catch { return null }
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [queue, setQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem('queue')) || [] } catch { return [] }
  })
  const [currentIndex, setCurrentIndex] = useState(() => {
    try { return Number(localStorage.getItem('currentIndex')) || 0 } catch { return 0 }
  })
  const [shuffle, setShuffle] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shuffle')) || false } catch { return false }
  })
  const [repeat, setRepeat] = useState(() => {
    try { return localStorage.getItem('repeat') || 'off' } catch { return 'off' }
  })
  const [progress, setProgress] = useState(() => {
    try { return Number(localStorage.getItem('progress')) || 0 } catch { return 0 }
  })
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (currentTrack) {
      localStorage.setItem('currentTrack', JSON.stringify(currentTrack))
      addToHistory(currentTrack)
    }
    localStorage.setItem('queue', JSON.stringify(queue))
    localStorage.setItem('currentIndex', currentIndex)
    localStorage.setItem('shuffle', shuffle)
    localStorage.setItem('repeat', repeat)
  }, [currentTrack, queue, currentIndex, shuffle, repeat, addToHistory])

  // Throttle progress save to localStorage
  const lastSaveTime = useRef(0)
  useEffect(() => {
    const now = Date.now()
    if (now - lastSaveTime.current > 5000) {
      localStorage.setItem('progress', progress)
      lastSaveTime.current = now
    }
  }, [progress])

  // Get active audio
  const getActiveAudio = useCallback(() => activeAudioIndex === 1 ? audio1Ref.current : audio2Ref.current, [activeAudioIndex])
  const getSecondaryAudio = useCallback(() => activeAudioIndex === 1 ? audio2Ref.current : audio1Ref.current, [activeAudioIndex])

  // Update MediaSession metadata and state
  useEffect(() => {
    if (Capacitor.isNativePlatform() && currentTrack) {
      MediaSession.setMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
      }).catch(console.error)
    }
  }, [currentTrack])

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      MediaSession.setPlaybackState({
        playbackState: isPlaying ? 'playing' : 'paused'
      }).catch(console.error)
    }
  }, [isPlaying])

  // Helper to get local or remote src
  const getTrackSrc = useCallback((track) => {
    const downloaded = downloadedSongs[track.id]
    if (downloaded && downloaded.localUri) {
      return Capacitor.convertFileSrc(downloaded.localUri)
    }
    return track.audioUrl
  }, [downloadedSongs])

  // Next Track Logic
  const getNextTrackInfo = useCallback(() => {
    if (queue.length === 0) return null
    let nextIdx
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length)
    } else {
      nextIdx = currentIndex + 1
      if (nextIdx >= queue.length) {
        if (repeat === 'all') nextIdx = 0
        else return null // end of queue
      }
    }
    return { track: queue[nextIdx], index: nextIdx }
  }, [queue, currentIndex, shuffle, repeat])

  useEffect(() => {
    const activeAudio = getActiveAudio()
    const secondaryAudio = getSecondaryAudio()

    const handleTimeUpdate = () => {
      if (!isCrossfading.current) {
        setProgress(activeAudio.currentTime)
        
        // Update MediaSession position natively (throttled to 1s)
        if (Capacitor.isNativePlatform()) {
          const now = Date.now()
          if (!activeAudio._lastMediaSessionUpdate || now - activeAudio._lastMediaSessionUpdate > 1000) {
            MediaSession.setPositionState({
              duration: activeAudio.duration || 0,
              position: activeAudio.currentTime,
              playbackRate: 1
            }).catch(() => {})
            activeAudio._lastMediaSessionUpdate = now
          }
        }
      }

      // Crossfade logic
      if (activeAudio.duration && activeAudio.duration - activeAudio.currentTime <= 3 && !isCrossfading.current) {
        let nextInfo = getNextTrackInfo()

        // Autoplay logic if end of queue and repeat is off
        if (!nextInfo && repeat === 'off' && allTracks.length > 0) {
            const randomIdx = Math.floor(Math.random() * allTracks.length);
            nextInfo = { track: allTracks[randomIdx], index: queue.length };
            // Append to queue for continuity
            setQueue(prev => [...prev, nextInfo.track])
        }

        if (nextInfo) {
          isCrossfading.current = true
          secondaryAudio.src = getTrackSrc(nextInfo.track)
          secondaryAudio.volume = 0
          secondaryAudio.play().then(() => {
            const fadeSteps = 10
            const stepTime = 3000 / fadeSteps
            let step = 0
            
            const fadeInterval = setInterval(() => {
              step++
              const fadeRatio = step / fadeSteps
              activeAudio.volume = Math.max(0, 1 - fadeRatio)
              secondaryAudio.volume = Math.min(1, fadeRatio)
              
              if (step >= fadeSteps) {
                clearInterval(fadeInterval)
                activeAudio.pause()
                activeAudio.currentTime = 0
                activeAudio.volume = 1
                secondaryAudio.volume = 1
                isCrossfading.current = false
                
                setActiveAudioIndex(prev => prev === 1 ? 2 : 1)
                setCurrentTrack(nextInfo.track)
                setCurrentIndex(nextInfo.index)
              }
            }, stepTime)
          }).catch(err => {
            console.error('Crossfade play failed:', err)
            isCrossfading.current = false
          })
        }
      }
    }
    
    const handleLoadedMetadata = () => setDuration(activeAudio.duration)
    const handleEnded = () => {
      if (repeat === 'one') {
        activeAudio.currentTime = 0
        activeAudio.play()
      } else {
        next()
      }
    }

    activeAudio.addEventListener('timeupdate', handleTimeUpdate)
    activeAudio.addEventListener('loadedmetadata', handleLoadedMetadata)
    activeAudio.addEventListener('ended', handleEnded)

    return () => {
      activeAudio.removeEventListener('timeupdate', handleTimeUpdate)
      activeAudio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      activeAudio.removeEventListener('ended', handleEnded)
    }
  }, [activeAudioIndex, getNextTrackInfo, repeat, queue, allTracks])
  
  // Set initial time if restored from local storage
  useEffect(() => {
    if (!isDownloadReady) return
    const activeAudio = getActiveAudio()
    if (currentTrack) {
      const src = getTrackSrc(currentTrack)
      if (!activeAudio.src.includes(src)) {
        activeAudio.src = src
        const savedProgress = Number(localStorage.getItem('progress')) || 0
        if (savedProgress > 0) {
          activeAudio.currentTime = savedProgress
        }
      }
    }
  }, [isDownloadReady]) // only when download ready

  const play = useCallback((track, trackList = null) => {
    if (!isDownloadReady) return
    if (trackList) {
      setQueue(trackList)
      const index = trackList.findIndex(t => t.id === track.id)
      setCurrentIndex(index >= 0 ? index : 0)
    }
    setCurrentTrack(track)
    const activeAudio = getActiveAudio()
    activeAudio.src = getTrackSrc(track)
    activeAudio.play().then(() => setIsPlaying(true)).catch(console.error)
  }, [getActiveAudio, getTrackSrc, isDownloadReady])

  const togglePlay = useCallback(() => {
    if (!currentTrack || !isDownloadReady) return
    const activeAudio = getActiveAudio()
    if (isPlaying) {
      activeAudio.pause()
      setIsPlaying(false)
    } else {
      activeAudio.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }, [currentTrack, isPlaying, getActiveAudio, isDownloadReady])

  const next = useCallback(() => {
    if (queue.length === 0 || !isDownloadReady) return
    let nextInfo = getNextTrackInfo()
    
    // Autoplay
    if (!nextInfo && repeat === 'off' && allTracks.length > 0) {
      const randomIdx = Math.floor(Math.random() * allTracks.length)
      const randomTrack = allTracks[randomIdx]
      setQueue(prev => [...prev, randomTrack])
      nextInfo = { track: randomTrack, index: queue.length }
    }

    if (nextInfo) {
      setCurrentIndex(nextInfo.index)
      setCurrentTrack(nextInfo.track)
      const activeAudio = getActiveAudio()
      activeAudio.src = getTrackSrc(nextInfo.track)
      activeAudio.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }, [queue, getNextTrackInfo, repeat, getActiveAudio, allTracks, getTrackSrc, isDownloadReady])

  const prev = useCallback(() => {
    if (!isDownloadReady) return
    const activeAudio = getActiveAudio()
    if (activeAudio.currentTime > 3) {
      activeAudio.currentTime = 0
      return
    }
    if (queue.length === 0) return
    let prevIndex = currentIndex - 1
    if (prevIndex < 0) {
      if (repeat === 'all') prevIndex = queue.length - 1
      else { activeAudio.currentTime = 0; return }
    }
    setCurrentIndex(prevIndex)
    const prevTrack = queue[prevIndex]
    setCurrentTrack(prevTrack)
    activeAudio.src = getTrackSrc(prevTrack)
    activeAudio.play().then(() => setIsPlaying(true)).catch(console.error)
  }, [queue, currentIndex, repeat, getActiveAudio, getTrackSrc, isDownloadReady])

  const seek = useCallback((time) => {
    const activeAudio = getActiveAudio()
    activeAudio.currentTime = time
    setProgress(time)
    if (Capacitor.isNativePlatform()) {
      MediaSession.setPositionState({
        duration: activeAudio.duration || 0,
        position: time,
        playbackRate: 1
      }).catch(() => {})
    }
  }, [getActiveAudio])

  // Setup MediaSession handlers after togglePlay, next, prev are defined
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      MediaSession.setActionHandler({ action: 'play' }, () => togglePlay())
      MediaSession.setActionHandler({ action: 'pause' }, () => togglePlay())
      MediaSession.setActionHandler({ action: 'nexttrack' }, () => next())
      MediaSession.setActionHandler({ action: 'previoustrack' }, () => prev())
    }
  }, [togglePlay, next, prev])

  // Handle app going to background/foreground to prevent media session crash
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handlePause = App.addListener('pause', () => {
      // App is going to background - pause audio if desired, keep media session alive
      // but safely reset action handlers to avoid ghost callbacks on resume
      try {
        MediaSession.setPlaybackState({
          playbackState: getActiveAudio().paused ? 'paused' : 'playing'
        }).catch(() => {})
      } catch (e) { /* ignore */ }
    })

    const handleResume = App.addListener('resume', () => {
      // App resumed - re-register all media session handlers defensively
      try {
        if (currentTrack) {
          MediaSession.setMetadata({
            title: currentTrack.title,
            artist: currentTrack.artist,
            artwork: [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
          }).catch(() => {})
        }
        MediaSession.setActionHandler({ action: 'play' }, () => togglePlay())
        MediaSession.setActionHandler({ action: 'pause' }, () => togglePlay())
        MediaSession.setActionHandler({ action: 'nexttrack' }, () => next())
        MediaSession.setActionHandler({ action: 'previoustrack' }, () => prev())
        MediaSession.setPlaybackState({
          playbackState: getActiveAudio().paused ? 'paused' : 'playing'
        }).catch(() => {})
      } catch (e) { console.error('Resume media session error:', e) }
    })

    return () => {
      handlePause.then(l => l.remove()).catch(() => {})
      handleResume.then(l => l.remove()).catch(() => {})
    }
  }, [togglePlay, next, prev, currentTrack, getActiveAudio])

  const toggleShuffle = useCallback(() => setShuffle(prev => !prev), [])

  const toggleRepeat = useCallback(() => {
    setRepeat(prev => {
      if (prev === 'off') return 'all'
      if (prev === 'all') return 'one'
      return 'off'
    })
  }, [])

  // Queue Management Functions
  const addToQueue = useCallback((track) => {
    setQueue(prev => [...prev, track])
    showToast(`Added ${track.title} to queue`)
  }, [showToast])

  const playNext = useCallback((track) => {
    setQueue(prev => {
      const newQueue = [...prev]
      newQueue.splice(currentIndex + 1, 0, track)
      return newQueue
    })
    showToast(`${track.title} will play next`)
  }, [currentIndex, showToast])

  const removeFromQueue = useCallback((index) => {
    setQueue(prev => {
      const newQueue = [...prev]
      newQueue.splice(index, 1)
      return newQueue
    })
    if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  const reorderQueue = useCallback((startIndex, endIndex) => {
    setQueue(prev => {
      const newQueue = [...prev]
      const [removed] = newQueue.splice(startIndex, 1)
      newQueue.splice(endIndex, 0, removed)
      return newQueue
    })
    
    if (currentIndex === startIndex) {
      setCurrentIndex(endIndex)
    } else if (startIndex < currentIndex && endIndex >= currentIndex) {
      setCurrentIndex(prev => prev - 1)
    } else if (startIndex > currentIndex && endIndex <= currentIndex) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex])

  // --- Memoized context values (the key perf fix) ---
  const coreValue = useMemo(() => ({
    currentTrack, isPlaying,
    shuffle, repeat,
    play, togglePlay, next, prev,
    toggleShuffle, toggleRepeat
  }), [currentTrack, isPlaying, shuffle, repeat, play, togglePlay, next, prev, toggleShuffle, toggleRepeat])

  const progressValue = useMemo(() => ({
    progress, duration, seek
  }), [progress, duration, seek])

  const queueValue = useMemo(() => ({
    queue, currentIndex,
    addToQueue, playNext, removeFromQueue, reorderQueue
  }), [queue, currentIndex, addToQueue, playNext, removeFromQueue, reorderQueue])

  return (
    <PlayerCoreContext.Provider value={coreValue}>
      <PlayerProgressContext.Provider value={progressValue}>
        <PlayerQueueContext.Provider value={queueValue}>
          {children}
        </PlayerQueueContext.Provider>
      </PlayerProgressContext.Provider>
    </PlayerCoreContext.Provider>
  )
}
