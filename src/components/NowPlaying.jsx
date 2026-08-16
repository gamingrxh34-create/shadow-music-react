import { usePlayer } from '../contexts/PlayerContext'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FastAverageColor } from 'fast-average-color'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import QueueSheet from './QueueSheet'
import {
  IoChevronDown, IoPlay, IoPause,
  IoPlaySkipBack, IoPlaySkipForward,
  IoShuffle, IoRepeat, IoStar, IoStarOutline, IoList
} from 'react-icons/io5'

function NowPlaying({ onClose }) {
  const {
    currentTrack, isPlaying, togglePlay,
    next, prev, seek, progress, duration,
    shuffle, repeat, toggleShuffle, toggleRepeat
  } = usePlayer()
  const { isSongLiked, toggleLikeSong } = useUserData()
  const { artists: allArtists, loading: musicDataLoading } = useMusicData()
  const [isClosing, setIsClosing] = useState(false)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [artistData, setArtistData] = useState(null)
  const [dominantColor, setDominantColor] = useState('#020c1b')
  const [showRemaining, setShowRemaining] = useState(false)
  const [showAllLyrics, setShowAllLyrics] = useState(false)

  useEffect(() => {
    if (currentTrack?.coverUrl) {
      const fac = new FastAverageColor()
      // Use tiny Cloudinary thumbnail for color extraction to avoid blocking main thread
      let colorUrl = currentTrack.coverUrl
      if (colorUrl.includes('/upload/')) {
        colorUrl = colorUrl.replace('/upload/', '/upload/w_50,h_50,c_fill/')
      }
      fac.getColorAsync(colorUrl)
        .then(color => {
          setDominantColor(color.hex)
        })
        .catch(e => {
          console.error('Failed to get dominant color', e)
          setDominantColor('#020c1b')
        })
    }
  }, [currentTrack?.coverUrl])

  useEffect(() => {
    if (currentTrack && !musicDataLoading) {
      if (allArtists[currentTrack.artist]) {
        setArtistData({ name: currentTrack.artist, ...allArtists[currentTrack.artist] })
      } else {
        setArtistData(null)
      }
    }
  }, [currentTrack?.artist, allArtists, musicDataLoading])

  if (!currentTrack) return null

  const liked = isSongLiked(currentTrack.id)

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleClose = () => {
    onClose()
  }

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0
  const lyricsLines = currentTrack.lyrics ? currentTrack.lyrics.split('<br>').map(l => l.trim()).filter(l => l) : []

  return (
    <>
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, { offset, velocity }) => {
          if (offset.y > 100 || velocity.y > 500) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
            handleClose();
          }
        }}
        className="fixed inset-0 z-[100] flex flex-col bg-[#050505]"
      >
        {/* Background - static gradient based on dominant color, NO heavy blur */}
        <div 
          className="absolute inset-0 z-0 transition-colors duration-1000" 
          style={{ 
            background: `linear-gradient(160deg, ${dominantColor}99 0%, #050505 50%, #050505 100%)`
          }}
        />

        {/* Scrollable Content */}
        <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="flex flex-col min-h-full px-7 pt-4 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between py-4 flex-shrink-0">
              <button onClick={handleClose} className="text-white/70 text-2xl press-scale p-1">
                <IoChevronDown />
              </button>
              <div className="text-center">
                <div className="text-[10px] font-semibold tracking-widest text-white/50 uppercase">Now Playing</div>
              </div>
              <button onClick={() => setIsQueueOpen(true)} className="text-white/70 text-2xl press-scale p-1">
                <IoList />
              </button>
            </div>

            {/* Album Art */}
            <div className="flex items-center justify-center py-6 flex-shrink-0 relative">
              {/* Glow Effect */}
              {isPlaying && (
                <motion.div 
                  className="absolute w-[88%] aspect-square rounded-[20px]"
                  style={{ boxShadow: `0 0 80px ${dominantColor}80` }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-[88%] aspect-square rounded-[20px] object-cover shadow-2xl shadow-black/80 relative z-10"
              />
            </div>

            {/* Track Info */}
            <div className="flex items-start justify-between mb-5 flex-shrink-0">
              <div className="flex-1 min-w-0 mr-4">
                <h2 className="text-xl font-bold text-white truncate">{currentTrack.title}</h2>
                <p className="text-sm text-white/60 mt-1">{currentTrack.artist}</p>
              </div>
              <button 
                onClick={() => toggleLikeSong(currentTrack.id)}
                className={`text-2xl press-scale mt-1 ${liked ? 'text-brand-300' : 'text-white/40'}`}
              >
                {liked ? <IoStar /> : <IoStarOutline />}
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mb-5 flex-shrink-0">
              <div className="py-3">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={progress}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="w-full h-1"
                  style={{
                    background: `linear-gradient(to right, ${dominantColor !== '#020c1b' ? dominantColor : '#fff'} ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[11px] font-medium text-white/50">{formatTime(progress)}</span>
                <span 
                  className="text-[11px] font-medium text-white/50 cursor-pointer"
                  onClick={() => setShowRemaining(!showRemaining)}
                >
                  {showRemaining && duration > 0 ? `-${formatTime(duration - progress)}` : formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-2 mb-10 flex-shrink-0">
              <button 
                onClick={toggleShuffle}
                className={`text-xl press-scale ${shuffle ? 'text-brand-300' : 'text-white/50'}`}
              >
                <IoShuffle />
              </button>
              <button onClick={prev} className="text-3xl text-white press-scale">
                <IoPlaySkipBack />
              </button>
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black text-2xl press-scale shadow-lg"
              >
                {isPlaying ? <IoPause /> : <IoPlay className="ml-1" />}
              </button>
              <button onClick={next} className="text-3xl text-white press-scale">
                <IoPlaySkipForward />
              </button>
              <button 
                onClick={toggleRepeat}
                className={`text-xl press-scale relative ${repeat !== 'off' ? 'text-brand-300' : 'text-white/50'}`}
              >
                <IoRepeat />
                {repeat === 'one' && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-black bg-brand-300 text-black rounded-full w-3 h-3 flex items-center justify-center">1</span>
                )}
              </button>
            </div>

            {/* Lyrics */}
            {lyricsLines.length > 0 && (
              <div className="flex-shrink-0 mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-brand-300">LYRICS</h3>
                </div>
                <div 
                  className="glass rounded-2xl px-5 py-5 overflow-hidden relative cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => setShowAllLyrics(prev => !prev)}
                >
                  {(showAllLyrics ? lyricsLines : lyricsLines.slice(0, 5)).map((line, i) => (
                    <p key={i} className={`text-sm mb-1.5 leading-relaxed ${
                      line === '\u266a' ? 'text-white/15 text-xs my-3' : 'text-white/70'
                    }`}>
                      {line === '\u266a' ? '♪' : line}
                    </p>
                  ))}
                  
                  {lyricsLines.length > 5 && (
                    <div className="mt-4 text-center">
                      <span className="text-[10px] font-bold text-brand-300/80 tracking-widest uppercase bg-white/5 px-3 py-1.5 rounded-full">
                        {showAllLyrics ? 'Tap to collapse' : 'Tap to expand'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* About the Artist */}
            {artistData && (
              <div className="flex-shrink-0 mb-8">
                <h3 className="text-sm font-bold text-white/50 mb-3">ABOUT THE ARTIST</h3>
                <div className="glass rounded-2xl p-5">
                  <div className="flex items-center gap-4 mb-3">
                    <img 
                      src={artistData.image || 'https://via.placeholder.com/60'} 
                      alt={artistData.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-white font-bold text-lg">{artistData.name}</div>
                    </div>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{artistData.bio}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      
      <QueueSheet isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
    </>
  )
}

export default NowPlaying
