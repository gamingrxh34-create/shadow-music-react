import { usePlayer } from '../contexts/PlayerContext'
import { useUserData } from '../contexts/UserDataContext'
import { IoPlay, IoPause, IoStar, IoStarOutline } from 'react-icons/io5'
import { motion } from 'framer-motion'

function MiniPlayer({ onExpand }) {
  const { currentTrack, isPlaying, togglePlay, progress, duration, next, prev } = usePlayer()
  const { isSongLiked, toggleLikeSong } = useUserData()

  if (!currentTrack) return null

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0
  const liked = isSongLiked(currentTrack.id)

  return (
    <motion.div 
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, { offset }) => {
        if (offset.x > 50) {
          prev();
        } else if (offset.x < -50) {
          next();
        }
      }}
      className="fixed left-2 right-2 z-40 animate-slide-up"
      style={{ bottom: 'calc(66px + env(safe-area-inset-bottom) + 8px)' }}
    >
      {/* Progress bar at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 rounded-t-xl overflow-hidden">
        <div 
          className="h-full bg-brand-300 transition-all duration-200 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div 
        className="glass-strong rounded-xl flex items-center gap-3 p-2 pr-3 cursor-pointer"
        onClick={onExpand}
      >
        <motion.img 
          layoutId="album-art"
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
