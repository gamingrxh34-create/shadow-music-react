import { IoPlay } from 'react-icons/io5'
import { usePlayer } from '../contexts/PlayerContext'
import { useDownload } from '../contexts/DownloadContext'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

function MediaCard({ item, type = 'song', allTracks = [] }) {
  const { play } = usePlayer()
  const { downloadedSongs } = useDownload()
  const navigate = useNavigate()

  const handleCardClick = () => {
    if (type === 'artist') navigate(`/artist/${item.name}`)
    else if (type === 'playlist') navigate(`/playlist/${item.id}`)
    else play(item, allTracks.length > 0 ? allTracks : [item]) // fallback for songs
  }

  const handlePlayClick = (e) => {
    e.stopPropagation()
    if (type === 'song' || type === 'playlist') {
      play(item, allTracks.length > 0 ? allTracks : [item])
    }
  }

  const isArtist = type === 'artist'
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  const downloaded = item?.id ? downloadedSongs?.[item.id] : null
  const coverSrc = (!isOnline && downloaded?.localCoverUri)
    ? Capacitor.convertFileSrc(downloaded.localCoverUri)
    : (item.coverUrl || item.image || 'https://via.placeholder.com/200?text=♪')

  return (
    <div 
      className="group flex flex-col gap-2 press-scale cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="relative">
        <img
          src={coverSrc}
          alt={item.title || item.name}
          className={`w-full aspect-square object-cover bg-surface-100 ${
            isArtist ? 'rounded-full' : 'rounded-lg'
          }`}
          loading="lazy"
        />
        {!isArtist && (
          <button 
            onClick={handlePlayClick}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-brand-300 flex items-center justify-center text-black shadow-lg opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 group-active:translate-y-0"
          >
            <IoPlay className="text-lg ml-0.5" />
          </button>
        )}
      </div>
      <div className="px-0.5">
        <div className="text-sm font-semibold text-white truncate">
          {item.title || item.name}
        </div>
        <div className="text-xs text-white/50 truncate">
          {item.artist || item.subtitle || (isArtist ? 'Artist' : '')}
        </div>
      </div>
    </div>
  )
}

export default MediaCard
