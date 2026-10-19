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

  // Update MediaSession metadata safely without crashing offline
  const updateNativeMetadata = useCallback((track) => {
    if (!Capacitor.isNativePlatform() || !track) return
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    const downloaded = downloadedSongs?.[track.id]
    const meta = {
      title: track.title || '',
      artist: track.artist || '',
      album: track.album || '',
      artwork: []
    }

    // Prefer local cached cover art, or remote HTTP if online
    if (downloaded && downloaded.localCoverUri) {
      meta.artwork = [{ src: downloaded.localCoverUri, sizes: '512x512', type: 'image/jpeg' }]
    } else if (track.coverUrl && isOnline) {
      meta.artwork = [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
    } else if (track.coverUrl && (track.coverUrl.startsWith('data:') || track.coverUrl.startsWith('file:'))) {
      meta.artwork = [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
    }

    MediaSession.setMetadata(meta).catch((err) => {
      console.warn('Native MediaSession setMetadata handled gracefully:', err)
    })
  }, [downloadedSongs])

  useEffect(() => {
    if (currentTrack) {
      updateNativeMetadata(currentTrack)
    }
  }, [currentTrack, updateNativeMetadata])

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      MediaSession.setPlaybackState({
        playbackState: isPlaying ? 'playing' : 'paused'
      }).catch(console.error)
    }
  }, [isPlaying])

  // Helper to get local or remote src
  const getTrackSrc = useCallback((track) => {
    if (!track?.id) return ''
    const downloaded = downloadedSongs?.[track.id]
    if (downloaded && downloaded.localUri) {
      return Capacitor.convertFileSrc(downloaded.localUri)
    }
    return track.audioUrl || ''
  }, [downloadedSongs])

  // Next Track Logic
  const getNextTrackInfo = useCallback(() => {
    if (queue.length === 0) return null
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    if (shuffle) {
      if (!isOnline) {
        const offlineIndices = queue
          .map((t, idx) => (downloadedSongs?.[t.id] ? idx : -1))
          .filter(idx => idx !== -1 && idx !== currentIndex)
        if (offlineIndices.length > 0) {
          const rand = offlineIndices[Math.floor(Math.random() * offlineIndices.length)]
          return { track: queue[rand], index: rand }
        }
      }
      const nextIdx = Math.floor(Math.random() * queue.length)
      return { track: queue[nextIdx], index: nextIdx }
    } else {
      let nextIdx = currentIndex + 1
      if (!isOnline) {
        // Skip undownloaded tracks offline
        while (nextIdx < queue.length && !downloadedSongs?.[queue[nextIdx]?.id]) {
          nextIdx++
        }
        if (nextIdx >= queue.length && repeat === 'all') {
          nextIdx = 0
          while (nextIdx < currentIndex && !downloadedSongs?.[queue[nextIdx]?.id]) {
            nextIdx++
          }
        }
      } else {
        if (nextIdx >= queue.length) {
          if (repeat === 'all') nextIdx = 0
          else return null // end of queue
        }
      }

      if (nextIdx < queue.length && queue[nextIdx]) {
        if (!isOnline && !downloadedSongs?.[queue[nextIdx].id]) return null
        return { track: queue[nextIdx], index: nextIdx }
      }
      return null
    }
  }, [queue, currentIndex, shuffle, repeat, downloadedSongs])

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
        activeAudio.play().catch(() => setIsPlaying(false))
      } else {
        next()
      }
    }

    const handleError = (e) => {
      console.warn('Audio playback error (offline or unreachable source):', e)
      setIsPlaying(false)
    }

    activeAudio.addEventListener('timeupdate', handleTimeUpdate)
    activeAudio.addEventListener('loadedmetadata', handleLoadedMetadata)
    activeAudio.addEventListener('ended', handleEnded)
    activeAudio.addEventListener('error', handleError)

    return () => {
      activeAudio.removeEventListener('timeupdate', handleTimeUpdate)
      activeAudio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      activeAudio.removeEventListener('ended', handleEnded)
      activeAudio.removeEventListener('error', handleError)
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
    if (!isDownloadReady || !track) return

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    const isDownloaded = !!(downloadedSongs && downloadedSongs[track.id])

    if (!isOnline && !isDownloaded) {
      showToast("Connect to the internet or play downloaded songs")
      return
    }

    if (trackList) {
      setQueue(trackList)
      const index = trackList.findIndex(t => t.id === track.id)
      setCurrentIndex(index >= 0 ? index : 0)
    }

    const effectiveTrack = (isDownloaded && downloadedSongs[track.id]?.localCoverUri && !isOnline)
      ? { ...track, coverUrl: Capacitor.convertFileSrc(downloadedSongs[track.id].localCoverUri) }
      : track

    setCurrentTrack(effectiveTrack)
    const activeAudio = getActiveAudio()
    activeAudio.src = getTrackSrc(effectiveTrack)
    activeAudio.play().then(() => setIsPlaying(true)).catch(err => {
      console.warn('Audio play failed:', err)
      setIsPlaying(false)
    })
  }, [getActiveAudio, getTrackSrc, isDownloadReady, downloadedSongs, showToast])

  const togglePlay = useCallback(() => {
    if (!currentTrack || !isDownloadReady) return
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    const isDownloaded = !!(downloadedSongs && downloadedSongs[currentTrack.id])
    if (!isOnline && !isDownloaded && !isPlaying) {
      showToast("Connect to the internet or play downloaded songs")
      return
    }
    const activeAudio = getActiveAudio()
    if (isPlaying) {
      activeAudio.pause()
      setIsPlaying(false)
    } else {
      activeAudio.play().then(() => setIsPlaying(true)).catch(err => {
        console.warn('Audio play failed:', err)
        setIsPlaying(false)
      })
    }
  }, [currentTrack, isPlaying, getActiveAudio, isDownloadReady, downloadedSongs, showToast])

  const next = useCallback(() => {
    if (queue.length === 0 || !isDownloadReady) return
    let nextInfo = getNextTrackInfo()
    
    // Autoplay
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    if (!nextInfo && repeat === 'off' && isOnline && allTracks.length > 0) {
      const randomIdx = Math.floor(Math.random() * allTracks.length)
      const randomTrack = allTracks[randomIdx]
      setQueue(prev => [...prev, randomTrack])
      nextInfo = { track: randomTrack, index: queue.length }
    }

    if (nextInfo) {
      const isDownloaded = !!(downloadedSongs && downloadedSongs[nextInfo.track.id])
      if (!isOnline && !isDownloaded) {
        showToast("Next song isn't downloaded for offline playback")
        setIsPlaying(false)
        return
      }

      const effectiveTrack = (isDownloaded && downloadedSongs[nextInfo.track.id]?.localCoverUri && !isOnline)
        ? { ...nextInfo.track, coverUrl: Capacitor.convertFileSrc(downloadedSongs[nextInfo.track.id].localCoverUri) }
        : nextInfo.track

      setCurrentIndex(nextInfo.index)
      setCurrentTrack(effectiveTrack)
      const activeAudio = getActiveAudio()
      activeAudio.src = getTrackSrc(effectiveTrack)
      activeAudio.play().then(() => setIsPlaying(true)).catch(err => {
        console.warn('Audio play failed:', err)
        setIsPlaying(false)
      })
    }
  }, [queue, getNextTrackInfo, repeat, getActiveAudio, allTracks, getTrackSrc, isDownloadReady, downloadedSongs, showToast])

  const prev = useCallback(() => {
    if (!isDownloadReady) return
    const activeAudio = getActiveAudio()
    if (activeAudio.currentTime > 3) {
      activeAudio.currentTime = 0
      return
    }
    if (queue.length === 0) return
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    let prevIndex = currentIndex - 1
    if (!isOnline) {
      while (prevIndex >= 0 && !downloadedSongs?.[queue[prevIndex]?.id]) {
        prevIndex--
      }
    }
    if (prevIndex < 0) {
      if (repeat === 'all') {
        prevIndex = queue.length - 1
        if (!isOnline) {
          while (prevIndex >= 0 && !downloadedSongs?.[queue[prevIndex]?.id]) {
            prevIndex--
          }
        }
        if (prevIndex < 0) {
          activeAudio.currentTime = 0
          return
        }
      } else {
        activeAudio.currentTime = 0
        return
      }
    }
    const prevTrack = queue[prevIndex]
    const isDownloaded = !!(downloadedSongs && downloadedSongs[prevTrack.id])
    if (!isOnline && !isDownloaded) {
      showToast("Previous song isn't downloaded for offline playback")
      setIsPlaying(false)
      return
    }

    const effectiveTrack = (isDownloaded && downloadedSongs[prevTrack.id]?.localCoverUri && !isOnline)
      ? { ...prevTrack, coverUrl: Capacitor.convertFileSrc(downloadedSongs[prevTrack.id].localCoverUri) }
      : prevTrack

    setCurrentIndex(prevIndex)
    setCurrentTrack(effectiveTrack)
    activeAudio.src = getTrackSrc(effectiveTrack)
    activeAudio.play().then(() => setIsPlaying(true)).catch(err => {
      console.warn('Audio play failed:', err)
      setIsPlaying(false)
    })
  }, [queue, currentIndex, repeat, getActiveAudio, getTrackSrc, isDownloadReady, downloadedSongs, showToast])

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
          updateNativeMetadata(currentTrack)
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
  }, [togglePlay, next, prev, currentTrack, getActiveAudio, updateNativeMetadata])

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
