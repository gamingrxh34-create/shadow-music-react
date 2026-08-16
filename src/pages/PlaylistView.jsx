import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePlayer } from '../contexts/PlayerContext'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import { useDownload } from '../contexts/DownloadContext'
import TrackRow from '../components/TrackRow'
import { IoArrowBack, IoPlay, IoHeart, IoDownloadOutline, IoCheckmarkCircle, IoPencil, IoMusicalNotes } from 'react-icons/io5'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

export default function PlaylistView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { play } = usePlayer()
  const { likedSongIds, playlists, reorderPlaylist, updatePlaylistCover } = useUserData()
  const { songs: allSongs } = useMusicData()
  const { downloadedSongs, downloadPlaylist, playlistDownloadProgress } = useDownload()

  let title, playlistSongs, isLiked, playlist

  if (id === 'liked') {
    title = 'Liked Songs'
    playlistSongs = allSongs.filter(s => likedSongIds.includes(s.id))
    isLiked = true
  } else {
    playlist = playlists.find(p => p.id === id)
    title = playlist?.name || 'Playlist'
    const songIds = playlist?.songIds || []
    playlistSongs = songIds.map(sid => allSongs.find(s => s.id === sid)).filter(Boolean)
    isLiked = false
  }

  // Calculate total listening time
  const totalMinutes = Math.round(playlistSongs.length * 3.5)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const timeStr = hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`

  const handleDragEnd = (result) => {
    if (!result.destination) return
    if (!isLiked && playlist) {
      reorderPlaylist(playlist.id, result.source.index, result.destination.index)
    }
  }

  const handleEditCover = () => {
    if (!isLiked && playlist) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (file) {
          updatePlaylistCover(playlist.id, file)
        }
      }
      input.click()
    }
  }

  return (
    <motion.div 
      className="page-enter pb-8 min-h-full"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, { offset }) => {
        if (offset.x > 100) {
          navigate(-1)
        }
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 glass px-4 py-3 flex items-center gap-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="text-white text-2xl press-scale"><IoArrowBack /></button>
        <h1 className="text-lg font-bold text-white truncate">{title}</h1>
      </div>

      <div className="px-4 pt-6 flex flex-col items-center">
        {isLiked ? (
          <div className="w-48 h-48 rounded-xl bg-gradient-to-br from-brand-300/80 to-brand-700 flex items-center justify-center shadow-2xl mb-4">
            <IoHeart className="text-white text-6xl" />
          </div>
        ) : (
          <div 
            className="w-48 h-48 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center shadow-2xl mb-4 relative overflow-hidden group cursor-pointer"
            onClick={handleEditCover}
          >
            {playlist?.coverUrl ? (
              <img src={playlist.coverUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white/40 text-5xl">♪</span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <IoPencil className="text-white text-3xl" />
            </div>
          </div>
        )}
        <h1 className="text-2xl font-bold text-white text-center mb-1">{title}</h1>
        <div className="text-white/50 text-sm mb-1">{playlistSongs.length} songs • {timeStr}</div>
        
        {/* Download button — only for real playlists, not Liked Songs */}
        {!isLiked && playlist && (() => {
          const progress = playlistDownloadProgress[playlist.id]
          const allDownloaded = playlistSongs.length > 0 && playlistSongs.every(s => downloadedSongs[s.id])

          if (allDownloaded) {
            return (
              <div className="flex items-center gap-2 text-brand-300 text-sm mt-2 mb-6">
                <IoCheckmarkCircle className="text-lg" />
                <span>Downloaded</span>
              </div>
            )
          }

          if (progress) {
            return (
              <div className="flex items-center gap-2 text-white/60 text-sm mt-2 mb-6">
                <IoDownloadOutline className="text-lg animate-pulse" />
                <span>Downloading {progress.done}/{progress.total}...</span>
              </div>
            )
          }

          return (
            <button
              onClick={() => downloadPlaylist(playlist.id, playlistSongs)}
              className="flex items-center gap-2 text-white/40 text-sm mt-2 mb-6 hover:text-white/60 transition-colors press-scale"
            >
              <IoDownloadOutline className="text-lg" />
              <span>Download</span>
            </button>
          )
        })()}

        {playlistSongs.length > 0 && (
          <button 
            onClick={() => play(playlistSongs[0], playlistSongs)}
            className="w-14 h-14 rounded-full bg-brand-300 flex items-center justify-center text-black text-2xl press-scale shadow-lg shadow-brand-300/20 mb-8"
          >
            <IoPlay className="ml-1" />
          </button>
        )}
      </div>

      {playlistSongs.length === 0 ? (
        <motion.div 
          className="text-center py-12 flex flex-col items-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {isLiked ? (
            <IoHeart className="text-white/15 text-5xl mb-4" />
          ) : (
            <IoMusicalNotes className="text-white/15 text-5xl mb-4" />
          )}
          <div className="text-white/30 text-lg font-medium">{isLiked ? 'No liked songs yet' : 'No songs in this playlist'}</div>
          <div className="text-white/20 text-sm mt-2 mb-6">{isLiked ? 'Tap the star icon to add songs' : 'Add songs from the home screen'}</div>
          <button 
            onClick={() => navigate('/home')}
            className="px-6 py-2 rounded-full bg-white/10 text-white font-semibold press-scale hover:bg-white/20 transition-colors"
          >
            Browse Home
          </button>
        </motion.div>
      ) : isLiked ? (
        <div className="flex flex-col">
          {playlistSongs.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} allTracks={playlistSongs} />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="playlist-tracks">
            {(provided) => (
              <div 
                className="flex flex-col"
                {...provided.droppableProps} 
                ref={provided.innerRef}
              >
                {playlistSongs.map((track, i) => (
                  <Draggable key={`${track.id}-${i}`} draggableId={`${track.id}-${i}`} index={i}>
                    {(dragProvided, dragSnapshot) => (
                      <TrackRow 
                        track={track} 
                        index={i} 
                        allTracks={playlistSongs} 
                        playlistId={playlist.id}
                        draggableProvided={dragProvided}
                        draggableSnapshot={dragSnapshot}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
      <div className="h-24" />
    </motion.div>
  )
}
