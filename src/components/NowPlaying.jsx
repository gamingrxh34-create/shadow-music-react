import { usePlayer } from '../contexts/PlayerContext'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import { useDownload } from '../contexts/DownloadContext'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FastAverageColor } from 'fast-average-color'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { getOptimizedImageUrl } from '../utils/imageUtils'
import { parseLyrics, fetchLyricsOnTheFly } from '../utils/lyricsUtils'
import QueueSheet from './QueueSheet'
import {
  IoChevronDown, IoPlay, IoPause,
  IoPlaySkipBack, IoPlaySkipForward,
  IoShuffle, IoRepeat, IoStar, IoStarOutline, IoList,
  IoDownloadOutline, IoCheckmarkCircle,
  IoMicOutline, IoMic,
  IoContractOutline
} from 'react-icons/io5'

function NowPlaying({ onClose }) {
  const {
    currentTrack, isPlaying, togglePlay,
    next, prev, seek, progress, duration,
    shuffle, repeat, toggleShuffle, toggleRepeat,
    getActiveAudio
  } = usePlayer()
  const { isSongLiked, toggleLikeSong } = useUserData()
  const { downloadedSongs, isDownloading, downloadSong, removeDownload } = useDownload()
  const { artists: allArtists, loading: musicDataLoading } = useMusicData()

  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [artistData, setArtistData] = useState(null)
  const [dominantColor, setDominantColor] = useState('#0a192f')
  const [showRemaining, setShowRemaining] = useState(false)
  const [viewMode, setViewMode] = useState('normal') // 'normal' | 'lyrics'

  // Lyrics state
  const [lyricsData, setLyricsData] = useState({ lines: [], isSynced: false, loading: false })
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1)
  const lyricLineRefs = useRef([])
  const fullLyricLineRefs = useRef([])
  const lyricsContainerRef = useRef(null)
  const isUserScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef(null)

  // 60fps high-precision playhead time tracker
  const [liveTime, setLiveTime] = useState(progress)

  // User lyric timing offset (per-song calibration in seconds)
  const [syncOffset, setSyncOffset] = useState(() => {
    if (!currentTrack?.id) return 0
    try {
      const saved = localStorage.getItem(`lyric_offset_${currentTrack.id}`)
      return saved !== null ? parseFloat(saved) : 0
    } catch {
      return 0
    }
  })

  // Load saved offset when song changes
  useEffect(() => {
    if (!currentTrack?.id) return
    try {
      const saved = localStorage.getItem(`lyric_offset_${currentTrack.id}`)
      setSyncOffset(saved !== null ? parseFloat(saved) : 0)
    } catch {
      setSyncOffset(0)
    }
  }, [currentTrack?.id])

  const adjustSyncOffset = (delta) => {
    triggerHaptic(ImpactStyle.Light)
    setSyncOffset(prev => {
      const nextVal = Math.round((prev + delta) * 10) / 10
      if (currentTrack?.id) {
        try {
          localStorage.setItem(`lyric_offset_${currentTrack.id}`, String(nextVal))
        } catch {}
      }
      return nextVal
    })
  }

  // Trigger light tactile feedback on actions
  const triggerHaptic = (style = ImpactStyle.Light) => {
    try {
      Haptics.impact({ style }).catch(() => {})
    } catch {}
  }

  // High precision time loop using requestAnimationFrame while playing
  useEffect(() => {
    if (!isPlaying) {
      setLiveTime(progress)
      return
    }

    let rafId
    const updateTick = () => {
      const audio = getActiveAudio ? getActiveAudio() : null
      if (audio && !audio.paused && !isNaN(audio.currentTime)) {
        setLiveTime(audio.currentTime)
      }
      rafId = requestAnimationFrame(updateTick)
    }

    rafId = requestAnimationFrame(updateTick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, getActiveAudio, progress])

  // Dominant color extraction
  useEffect(() => {
    if (currentTrack?.coverUrl) {
      const fac = new FastAverageColor()
      let colorUrl = currentTrack.coverUrl
      if (colorUrl.includes('/upload/')) {
        colorUrl = colorUrl.replace('/upload/', '/upload/w_50,h_50,c_fill/')
      }
      fac.getColorAsync(colorUrl)
        .then(color => {
          setDominantColor(color.hex)
        })
        .catch(() => {
          setDominantColor('#0a192f')
        })
    }
  }, [currentTrack?.coverUrl])

  // Artist data lookup
  useEffect(() => {
    if (currentTrack && !musicDataLoading) {
      if (allArtists && allArtists[currentTrack.artist]) {
        setArtistData({ name: currentTrack.artist, ...allArtists[currentTrack.artist] })
      } else {
        setArtistData(null)
      }
    }
  }, [currentTrack?.artist, allArtists, musicDataLoading])

  // Lyrics processing & on-the-fly fetch
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData({ lines: [], isSynced: false, loading: false })
      return
    }

    let isMounted = true

    // 1. Check if track already has synced or plain lyrics
    const initialRaw = currentTrack.syncedLyrics || currentTrack.lyrics || ''
    const initialParsed = parseLyrics(initialRaw)

    if (initialParsed.isSynced && initialParsed.lines.length > 0) {
      setLyricsData({ lines: initialParsed.lines, isSynced: true, loading: false })
      return
    }

    // 2. Set whatever initial parsed lyrics we have
    setLyricsData({
      lines: initialParsed.lines,
      isSynced: initialParsed.isSynced,
      loading: !initialParsed.isSynced
    })

    // 3. Fallback: try fetching synced lyrics from LRCLIB if not already synced
    if (!initialParsed.isSynced) {
      fetchLyricsOnTheFly(currentTrack.title, currentTrack.artist, currentTrack.id)
        .then(result => {
          if (!isMounted || !result?.lyrics) return
          const newlyParsed = parseLyrics(result.lyrics)
          if (newlyParsed.lines.length > 0) {
            setLyricsData({
              lines: newlyParsed.lines,
              isSynced: newlyParsed.isSynced,
              loading: false
            })
          }
        })
        .catch(() => {
          if (isMounted) {
            setLyricsData(prev => ({ ...prev, loading: false }))
          }
        })
    }

    return () => {
      isMounted = false
    }
  }, [currentTrack?.id, currentTrack?.lyrics, currentTrack?.syncedLyrics, currentTrack?.title, currentTrack?.artist])

  // High-precision active lyric calculation with interval detection
  useEffect(() => {
    if (!lyricsData.isSynced || lyricsData.lines.length === 0) {
      setActiveLyricIndex(-1)
      return
    }

    const lines = lyricsData.lines
    const currentPos = liveTime + syncOffset

    let activeIdx = -1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.time !== null && currentPos >= line.time) {
        if (line.endTime !== null && currentPos >= line.endTime) {
          continue
        }
        activeIdx = i
        break
      }
    }

    // Fallback: if in between lines or gap, highlight closest recent line if within 5.5s
    if (activeIdx === -1) {
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].time !== null && currentPos >= lines[i].time) {
          if (currentPos - lines[i].time < 5.5) {
            activeIdx = i
          }
          break
        }
      }
    }

    setActiveLyricIndex(activeIdx)
  }, [liveTime, syncOffset, lyricsData])

  // Smooth auto-scroll to active lyric
  useEffect(() => {
    if (activeLyricIndex >= 0 && !isUserScrollingRef.current) {
      const activeEl = viewMode === 'lyrics' 
        ? fullLyricLineRefs.current[activeLyricIndex] 
        : lyricLineRefs.current[activeLyricIndex]
      
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeLyricIndex, viewMode])

  if (!currentTrack) return null

  const liked = isSongLiked ? isSongLiked(currentTrack.id) : false
  const isDownloaded = !!(downloadedSongs && downloadedSongs[currentTrack.id])
  const downloading = !!(isDownloading && isDownloading[currentTrack.id])

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleClose = () => {
    triggerHaptic(ImpactStyle.Light)
    onClose()
  }

  const handleSeek = (time) => {
    seek(time)
    setLiveTime(time)
  }

  const handleLyricTap = (time) => {
    if (time !== null && !isNaN(time)) {
      triggerHaptic(ImpactStyle.Light)
      seek(time)
      setLiveTime(time)
    }
  }

  const handleScrollActivity = () => {
    isUserScrollingRef.current = true
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false
    }, 3200)
  }

  const progressPercent = duration > 0 ? (liveTime / duration) * 100 : 0
  const hasLyrics = lyricsData.lines.length > 0

  return (
    <>
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        drag={viewMode === 'lyrics' ? false : 'y'}
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.65 }}
        dragSnapToOrigin={true}
        onDragEnd={(e, { offset, velocity }) => {
          if (offset.y > 60 || velocity.y > 350) {
            handleClose()
          }
        }}
        className="fixed inset-0 z-[100] flex flex-col bg-[#050505] select-none overflow-hidden"
      >
        {/* Dynamic ambient backdrop */}
        <div 
          className="absolute inset-0 z-0 transition-all duration-1000 ease-out" 
          style={{ 
            background: `radial-gradient(circle at 50% 25%, ${dominantColor}bf 0%, ${dominantColor}40 45%, #050505 85%, #050505 100%)`
          }}
        />

        {/* Ambient floating glow orb */}
        <div 
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-colors duration-1000"
          style={{ backgroundColor: `${dominantColor}66` }}
        />

        {/* Grab Handle (Normal View) */}
        {viewMode !== 'lyrics' && (
          <div 
            className="relative z-20 w-full pt-3 pb-1 flex justify-center items-center flex-shrink-0 cursor-grab active:cursor-grabbing"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
          >
            <div className="w-10 h-1.5 rounded-full bg-white/25 active:bg-white/50 transition-colors" />
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW MODE: IMMERSIVE FULLSCREEN LYRICS                            */}
        {/* ------------------------------------------------------------------ */}
        <AnimatePresence mode="wait">
          {viewMode === 'lyrics' ? (
            <motion.div
              key="immersive-lyrics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
              className="relative z-10 flex flex-col h-full"
              style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))' }}
            >
              {/* Header with Title and Sync Calibrator */}
              <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                  <img
                    src={getOptimizedImageUrl(currentTrack.coverUrl, 100)}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shadow-md border border-white/10"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{currentTrack.title}</h3>
                    <p className="text-xs text-white/60 truncate">{currentTrack.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Live Sync Calibrator Tool */}
                  {lyricsData.isSynced && (
                    <div className="flex items-center gap-1 bg-white/[0.08] border border-white/10 rounded-full px-2 py-0.5 text-xs">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider mr-0.5">SYNC</span>
                      <button
                        onClick={() => adjustSyncOffset(-0.2)}
                        className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold flex items-center justify-center text-xs press-scale"
                        title="Lyrics earlier (-0.2s)"
                      >
                        -
                      </button>
                      <span className={`font-mono text-[10px] font-bold px-1 min-w-[32px] text-center ${syncOffset !== 0 ? 'text-brand-300' : 'text-white/60'}`}>
                        {syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
                      </span>
                      <button
                        onClick={() => adjustSyncOffset(0.2)}
                        className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold flex items-center justify-center text-xs press-scale"
                        title="Lyrics later (+0.2s)"
                      >
                        +
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      triggerHaptic(ImpactStyle.Light)
                      setViewMode('normal')
                    }}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg press-scale transition-colors"
                    title="Close Full Lyrics"
                  >
                    <IoContractOutline />
                  </button>
                </div>
              </div>

              {/* Full Karaoke Lyrics Stream */}
              <div
                ref={lyricsContainerRef}
                onScroll={handleScrollActivity}
                onTouchStart={handleScrollActivity}
                className="flex-1 overflow-y-auto px-7 py-8 space-y-7 custom-scrollbar"
              >
                {lyricsData.loading && (
                  <div className="flex items-center justify-center py-20 text-brand-300 gap-2">
                    <div className="w-4 h-4 border-2 border-brand-300 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold tracking-wider uppercase">Loading Karaoke Sync...</span>
                  </div>
                )}

                {lyricsData.lines.map((line, idx) => {
                  const isActive = idx === activeLyricIndex
                  const isPast = activeLyricIndex !== -1 && idx < activeLyricIndex

                  return (
                    <motion.p
                      key={idx}
                      ref={el => (fullLyricLineRefs.current[idx] = el)}
                      onClick={() => handleLyricTap(line.time)}
                      className={`text-2xl md:text-3xl font-extrabold cursor-pointer transition-all duration-200 leading-relaxed ${
                        isActive
                          ? 'text-white scale-[1.03] origin-left drop-shadow-[0_0_20px_rgba(56,209,176,0.65)] text-brand-300'
                          : isPast
                          ? 'text-white/40 font-medium'
                          : 'text-white/25 hover:text-white/60 font-medium'
                      }`}
                    >
                      {line.isInterlude ? (
                        <span className={`inline-flex items-center gap-1.5 tracking-widest text-xl ${isActive ? 'text-brand-300 animate-pulse' : 'text-white/20'}`}>
                          <span>•</span><span>•</span><span>•</span>
                        </span>
                      ) : (
                        line.text
                      )}
                    </motion.p>
                  )
                })}

                <div className="h-32" /> {/* Bottom breathing room */}
              </div>

              {/* Floating Bottom Minimal Controls for Immersive Lyrics */}
              <div 
                className="flex-shrink-0 px-6 py-4 glass-strong border-t border-white/10"
                style={{ paddingBottom: 'calc(max(14px, env(safe-area-inset-bottom, 0px)) + 8px)' }}
              >
                {/* Micro Scrubber */}
                <div 
                  className="mb-3"
                  onPointerDown={e => e.stopPropagation()}
                >
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={liveTime}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    className="w-full h-1 cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #38d1b0 ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`
                    }}
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-white/50 font-medium">
                    <span>{formatTime(liveTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4">
                  <button onClick={() => { triggerHaptic(); prev(); }} className="text-2xl text-white/70 hover:text-white press-scale">
                    <IoPlaySkipBack />
                  </button>
                  <button
                    onClick={() => { triggerHaptic(ImpactStyle.Medium); togglePlay(); }}
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black text-xl press-scale shadow-lg shadow-black/50 hover:scale-105 transition-transform"
                  >
                    {isPlaying ? <IoPause /> : <IoPlay className="ml-0.5" />}
                  </button>
                  <button onClick={() => { triggerHaptic(); next(); }} className="text-2xl text-white/70 hover:text-white press-scale">
                    <IoPlaySkipForward />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (

            /* ------------------------------------------------------------------ */
            /* VIEW MODE: NORMAL (ALBUM ART, SCRUBBER & SYNCED LYRICS PREVIEW)   */
            /* ------------------------------------------------------------------ */
            <motion.div
              key="normal-player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar"
            >
              <div className="flex flex-col min-h-full px-7 pt-1 pb-10">
                {/* Header */}
                <div className="flex items-center justify-between py-3 flex-shrink-0">
                  <button 
                    onClick={handleClose} 
                    className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white text-2xl press-scale rounded-full hover:bg-white/10"
                  >
                    <IoChevronDown />
                  </button>
                  <div className="text-center px-2 min-w-0 flex-1">
                    <div className="text-[10px] font-bold tracking-widest text-brand-300/80 uppercase">Now Playing</div>
                    <div className="text-xs font-semibold text-white/90 truncate">{currentTrack.title}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Dedicated Lyrics Karaoke Icon Button (Microphone) */}
                    {hasLyrics && (
                      <button 
                        onClick={() => {
                          triggerHaptic(ImpactStyle.Light)
                          setViewMode('lyrics')
                        }} 
                        className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-brand-300 text-xl press-scale rounded-full hover:bg-white/10 transition-colors"
                        title="Karaoke Lyrics"
                      >
                        <IoMicOutline />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        triggerHaptic(ImpactStyle.Light)
                        setIsQueueOpen(true)
                      }} 
                      className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white text-2xl press-scale rounded-full hover:bg-white/10"
                    >
                      <IoList />
                    </button>
                  </div>
                </div>

                {/* Album Art with Ambient Glow */}
                <div className="flex items-center justify-center py-5 flex-shrink-0 relative">
                  {isPlaying && (
                    <motion.div 
                      className="absolute w-[86%] aspect-square rounded-[24px]"
                      style={{ boxShadow: `0 0 90px ${dominantColor}99` }}
                      animate={{ opacity: [0.55, 0.95, 0.55] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  <img
                    src={getOptimizedImageUrl(currentTrack.coverUrl, 600)}
                    alt={currentTrack.title}
                    className="w-[86%] aspect-square rounded-[24px] object-cover shadow-2xl shadow-black/90 relative z-10 border border-white/10"
                  />
                </div>

                {/* Track Info & Action Badges */}
                <div className="flex items-start justify-between mb-4 flex-shrink-0">
                  <div className="flex-1 min-w-0 mr-4">
                    <h2 className="text-xl font-bold text-white truncate">{currentTrack.title}</h2>
                    <p className="text-sm text-white/60 mt-0.5 truncate">{currentTrack.artist}</p>
                    
                    {/* Audio Quality & Explicit Badges */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded bg-brand-300/15 text-brand-300 border border-brand-300/20 uppercase">
                        Lossless • 320 KBPS
                      </span>
                      {lyricsData.isSynced && (
                        <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/80">
                          LIVE LYRICS
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        triggerHaptic(ImpactStyle.Medium)
                        isDownloaded ? removeDownload(currentTrack.id) : downloadSong(currentTrack)
                      }}
                      disabled={downloading}
                      className="text-2xl press-scale p-1 text-white/50 hover:text-white"
                      title={isDownloaded ? "Downloaded (tap to remove)" : "Download for offline"}
                    >
                      {isDownloaded ? (
                        <IoCheckmarkCircle className="text-brand-300" />
                      ) : downloading ? (
                        <div className="w-5 h-5 border-2 border-brand-300 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <IoDownloadOutline className="hover:text-brand-300 transition-colors" />
                      )}
                    </button>
                    <button 
                      onClick={() => {
                        triggerHaptic(ImpactStyle.Light)
                        toggleLikeSong(currentTrack.id)
                      }}
                      className={`text-2xl press-scale p-1 transition-colors ${liked ? 'text-brand-300' : 'text-white/40 hover:text-white'}`}
                    >
                      {liked ? <IoStar /> : <IoStarOutline />}
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Scrubber with Generous Touch Target */}
                <div 
                  className="mb-5 flex-shrink-0"
                  onPointerDown={e => e.stopPropagation()}
                >
                  <div className="py-2.5 relative flex items-center cursor-pointer">
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={liveTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${dominantColor !== '#0a192f' ? dominantColor : '#38d1b0'} ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] font-medium text-white/50">{formatTime(liveTime)}</span>
                    <span 
                      className="text-[11px] font-medium text-white/50 cursor-pointer hover:text-white transition-colors"
                      onClick={() => setShowRemaining(!showRemaining)}
                    >
                      {showRemaining && duration > 0 ? `-${formatTime(duration - liveTime)}` : formatTime(duration)}
                    </span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center justify-between px-2 mb-8 flex-shrink-0">
                  <button 
                    onClick={() => {
                      triggerHaptic()
                      toggleShuffle()
                    }}
                    className={`text-xl press-scale transition-colors ${shuffle ? 'text-brand-300' : 'text-white/50 hover:text-white'}`}
                    title="Shuffle"
                  >
                    <IoShuffle />
                  </button>
                  <button 
                    onClick={() => {
                      triggerHaptic()
                      prev()
                    }} 
                    className="text-3xl text-white press-scale"
                    title="Previous"
                  >
                    <IoPlaySkipBack />
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(ImpactStyle.Medium)
                      togglePlay()
                    }}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black text-2xl press-scale shadow-xl shadow-black/60 hover:scale-105 transition-transform"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <IoPause /> : <IoPlay className="ml-1" />}
                  </button>
                  <button 
                    onClick={() => {
                      triggerHaptic()
                      next()
                    }} 
                    className="text-3xl text-white press-scale"
                    title="Next"
                  >
                    <IoPlaySkipForward />
                  </button>
                  <button 
                    onClick={() => {
                      triggerHaptic()
                      toggleRepeat()
                    }}
                    className={`text-xl press-scale relative transition-colors ${repeat !== 'off' ? 'text-brand-300' : 'text-white/50 hover:text-white'}`}
                    title="Repeat"
                  >
                    <IoRepeat />
                    {repeat === 'one' && (
                      <span className="absolute -top-1 -right-1 text-[8px] font-black bg-brand-300 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>
                    )}
                  </button>
                </div>

                {/* ---------------------------------------------------------- */}
                {/* Real-time Synced Karaoke Lyrics Preview Card               */}
                {/* ---------------------------------------------------------- */}
                {hasLyrics && (
                  <div className="flex-shrink-0 mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <IoMic className="text-brand-300 text-sm" />
                        <h3 className="text-xs font-bold tracking-wider text-brand-300 uppercase">Lyrics</h3>
                      </div>
                      <button
                        onClick={() => {
                          triggerHaptic(ImpactStyle.Light)
                          setViewMode('lyrics')
                        }}
                        className="text-[11px] font-bold text-white/50 hover:text-brand-300 transition-colors uppercase tracking-wider"
                      >
                        Fullscreen
                      </button>
                    </div>

                    <div 
                      onClick={() => {
                        triggerHaptic(ImpactStyle.Light)
                        setViewMode('lyrics')
                      }}
                      className="glass rounded-2xl p-5 overflow-hidden relative cursor-pointer active:scale-[0.99] transition-transform border border-white/10 hover:border-brand-300/30"
                    >
                      <div className="space-y-3">
                        {lyricsData.lines.slice(0, 5).map((line, idx) => {
                          const isCur = idx === activeLyricIndex
                          return (
                            <p 
                              key={idx}
                              ref={el => (lyricLineRefs.current[idx] = el)}
                              className={`text-base font-bold transition-all duration-200 leading-snug ${
                                isCur 
                                  ? 'text-brand-300 scale-[1.02] origin-left' 
                                  : 'text-white/40'
                              }`}
                            >
                              {line.isInterlude ? '•••' : line.text}
                            </p>
                          )
                        })}
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-brand-300 tracking-widest uppercase flex items-center gap-1.5">
                          <IoMic className="text-xs" />
                          <span>{lyricsData.isSynced ? 'Synced Karaoke' : 'Tap for full lyrics'}</span>
                        </span>
                        <span className="text-xs text-white/40 font-semibold group-hover:text-white">
                          Expand ↗
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* About the Artist */}
                {artistData && (
                  <div className="flex-shrink-0 mb-8">
                    <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">About The Artist</h3>
                    <div className="glass rounded-2xl p-5 border border-white/5">
                      <div className="flex items-center gap-4 mb-3">
                        <img 
                          src={getOptimizedImageUrl(artistData.image, 150)} 
                          alt={artistData.name}
                          className="w-14 h-14 rounded-full object-cover border border-white/10"
                        />
                        <div>
                          <div className="text-white font-bold text-base">{artistData.name}</div>
                          <div className="text-brand-300 text-xs font-medium">Artist Profile</div>
                        </div>
                      </div>
                      <p className="text-white/60 text-xs leading-relaxed">{artistData.bio}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      <QueueSheet isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
    </>
  )
}

export default NowPlaying
