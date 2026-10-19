import { useState, useEffect } from 'react'
import { usePlayer } from '../contexts/PlayerContext'
import { useUserData } from '../contexts/UserDataContext'
import { IoPlay, IoPause, IoStar, IoStarOutline } from 'react-icons/io5'
import { motion } from 'framer-motion'
import { FastAverageColor } from 'fast-average-color'

function MiniPlayer({ onExpand }) {
  const { currentTrack, isPlaying, togglePlay, progress, duration, next, prev, seek } = usePlayer()
  const { isSongLiked, toggleLikeSong } = useUserData()

  if (!currentTrack) return null

  const [dominantColor, setDominantColor] = useState('rgba(255,255,255,0.05)')

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
          setDominantColor('rgba(255,255,255,0.05)')
        })
    }
  }, [currentTrack?.coverUrl])

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0
  const liked = isSongLiked(currentTrack.id)

  return (
    <motion.div 
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      dragSnapToOrigin={true}
      onDragEnd={(e, { offset, velocity }) => {
        if (offset.x > 50 || velocity.x > 300) {
          prev();
        } else if (offset.x < -50 || velocity.x < -300) {
          next();
        }
      }}
      className="fixed left-2 right-2 z-40 animate-slide-up"
      style={{ bottom: 'calc(66px + env(safe-area-inset-bottom) + 8px)' }}
    >
      {/* Interactive Seek Slider */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl overflow-visible">
        <div 
          className="h-full bg-white/10 rounded-t-xl"
          style={{ width: '100%' }}
        />
        <div 
          className="absolute top-0 left-0 h-full bg-brand-300 rounded-tl-xl"
          style={{ width: `${progressPercent}%` }}
        />
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={progress}
          onChange={(e) => { e.stopPropagation(); seek(Number(e.target.value)) }}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-3 -top-1"
          style={{ zIndex: 10 }}
        />
      </div>

      <div 
        className="rounded-xl flex items-center gap-3 p-2 pr-3 cursor-pointer shadow-lg transition-colors duration-1000 border border-white/5"
        style={{ backgroundColor: dominantColor }}
        onClick={onExpand}
      >
        <img 
          src={currentTrack.coverUrl} 
          alt={currentTrack.title}
          className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {currentTrack.title}
          </div>
          <div className="text-xs text-white/50 truncate">
            {currentTrack.artist}
          </div>
        </div>

        {/* Star Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); toggleLikeSong(currentTrack.id) }}
          className={`text-lg press-scale ${liked ? 'text-brand-300' : 'text-white/30'}`}
        >
          {liked ? <IoStar /> : <IoStarOutline />}
        </button>

        {/* Play/Pause */}
        <button 
          onClick={(e) => { e.stopPropagation(); togglePlay() }}
          className="w-9 h-9 flex items-center justify-center text-white text-xl press-scale"
        >
          {isPlaying ? <IoPause /> : <IoPlay />}
        </button>
      </div>
    </motion.div>
  )
}

export default MiniPlayer
