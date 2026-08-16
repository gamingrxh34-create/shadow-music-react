import { useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayer } from '../contexts/PlayerContext'
import { useUserData } from '../contexts/UserDataContext'
import { useDownload } from '../contexts/DownloadContext'
import { IoEllipsisVertical, IoStar, IoStarOutline, IoAdd, IoPersonOutline, IoMusicalNotes, IoMenu, IoTrashOutline, IoDownloadOutline, IoCheckmarkCircle, IoPlayOutline, IoListOutline } from 'react-icons/io5'
import BottomSheet from './BottomSheet'

function TrackRow({ track, index, allTracks, playlistId, draggableProvided, draggableSnapshot }) {
  const { play, currentTrack, isPlaying, addToQueue, playNext } = usePlayer()
  const { isSongLiked, toggleLikeSong, playlists, addSongToPlaylist, removeSongFromPlaylist } = useUserData()
  const { downloadedSongs, isDownloading, downloadSong, removeDownload } = useDownload()
  const navigate = useNavigate()
  const [sheetType, setSheetType] = useState(null)
  
  const isCurrent = currentTrack?.id === track.id
  const liked = isSongLiked(track.id)
  const isDownloaded = !!downloadedSongs[track.id]
  const downloading = isDownloading[track.id]

  const handleClick = () => {
    play(track, allTracks)
  }

  const handleStarClick = (e) => {
    e.stopPropagation()
    if (liked) {
      toggleLikeSong(track.id)
    } else {
      setSheetType('star')
    }
  }

  const wrapperProps = draggableProvided ? {
    ref: draggableProvided.innerRef,
    ...draggableProvided.draggableProps,
    style: {
      ...draggableProvided.draggableProps.style,
      opacity: draggableSnapshot?.isDragging ? 0.8 : 1,
    }
  } : {}

  return (
    <>
      <motion.div 
        {...wrapperProps}
        onClick={handleClick}
        whileTap={{ scale: 0.97 }}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
          isCurrent ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04] active:bg-white/[0.08]'
        } ${draggableSnapshot?.isDragging ? 'bg-white/[0.1] shadow-xl' : ''}`}
      >
        {playlistId && draggableProvided && (
          <div 
            {...draggableProvided.dragHandleProps} 
            className="text-white/30 hover:text-white/60 p-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <IoMenu className="text-xl" />
          </div>
        )}
        
        <img 
          src={track.coverUrl}
          alt=""
          className="w-11 h-11 rounded-md object-cover flex-shrink-0"
          loading="lazy"
        />

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${
            isCurrent ? 'text-brand-300' : 'text-white'
          }`}>
            <AnimatePresence>
              {isCurrent && isPlaying && (
                <motion.span 
                  className="playing-bars inline-flex mr-2"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <span /><span /><span />
                </motion.span>
              )}
            </AnimatePresence>
            {track.title}
          </div>
          <div className="flex items-center gap-1 text-xs text-white/50 truncate">
            {isDownloaded && <IoCheckmarkCircle className="text-brand-300" />}
            {track.artist}
          </div>
        </div>

        {/* Star Button - inline */}
        <motion.button 
          onClick={handleStarClick}
          whileTap={{ scale: 0.8 }}
          animate={liked ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`text-lg flex-shrink-0 ${
            liked ? 'text-brand-300' : 'text-white/25 hover:text-white/50'
          }`}
        >
          {liked ? <IoStar /> : <IoStarOutline />}
        </motion.button>

        {/* More Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); setSheetType('menu') }}
          className="text-white/30 text-lg p-1 press-scale hover:text-white/60 flex-shrink-0"
        >
          <IoEllipsisVertical />
        </button>
      </motion.div>

      <BottomSheet isOpen={sheetType === 'star'} onClose={() => setSheetType(null)}>
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
          <img src={track.coverUrl} alt="" className="w-10 h-10 rounded-md object-cover" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{track.title}</div>
            <div className="text-xs text-white/50">{track.artist}</div>
          </div>
        </div>

        <button 
          onClick={() => { toggleLikeSong(track.id); setSheetType(null) }}
          className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors w-full"
        >
          <IoStar className="text-xl text-brand-300" />
          <span className="text-white">Add to Liked Songs</span>
        </button>

        {playlists.length > 0 && (
          <>
            <div className="text-xs font-bold text-white/30 uppercase tracking-wider mt-3 mb-2 px-3">Also add to playlist</div>
            {playlists.map(p => (
              <button 
                key={p.id}
                onClick={() => { addSongToPlaylist(p.id, track.id); setSheetType(null) }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors w-full"
              >
                <IoMusicalNotes className="text-lg text-white/50" />
                <span className="text-white">{p.name}</span>
              </button>
            ))}
          </>
        )}
      </BottomSheet>

      <BottomSheet isOpen={sheetType === 'menu'} onClose={() => setSheetType(null)}>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
          <img src={track.coverUrl} alt="" className="w-12 h-12 rounded-md object-cover" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{track.title}</div>
            <div className="text-xs text-white/50">{track.artist}</div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <button 
            onClick={() => { setSheetType('star') }}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors w-full"
          >
            <IoAdd className="text-xl text-white/70" />
            <span className="text-white">Add to Playlist</span>
          </button>
          <button 
            onClick={() => { setSheetType(null); navigate(`/artist/${track.artist}`) }}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors w-full"
          >
            <IoPersonOutline className="text-xl text-white/70" />
            <span className="text-white">View Artist</span>
          </button>

          <button 
            onClick={() => { addToQueue && addToQueue(track); setSheetType(null); }}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors w-full"
          >
            <IoListOutline className="text-xl text-white/70" />
            <span className="text-white">Add to Queue</span>
          </button>

          <button 
            onClick={() => { playNext && playNext(track); setSheetType(null); }}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors w-full"
          >
            <IoPlayOutline className="text-xl text-white/70" />
            <span className="text-white">Play Next</span>
          </button>
          
          {playlistId && (
            <button 
              onClick={() => { 
                removeSongFromPlaylist(playlistId, track.id); 
                setSheetType(null); 
              }}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-red-500/10 transition-colors w-full text-red-400 mt-2"
            >
              <IoTrashOutline className="text-xl" />
              <span>Remove from Playlist</span>
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  )
}

export default memo(TrackRow)
