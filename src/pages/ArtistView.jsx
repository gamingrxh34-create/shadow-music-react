import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePlayer } from '../contexts/PlayerContext'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import TrackRow from '../components/TrackRow'
import { IoArrowBack, IoPlay } from 'react-icons/io5'

export default function ArtistView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { play } = usePlayer()
  const { isArtistFollowed, toggleFollowArtist } = useUserData()
  const { songs: allSongs, artists: allArtists, loading: musicDataLoading } = useMusicData()
  const [artist, setArtist] = useState(null)
  const [songs, setSongs] = useState([])

  const artistName = decodeURIComponent(id)

  useEffect(() => {
    if (musicDataLoading) return
    const found = Object.entries(allArtists).find(([name]) => name.toLowerCase() === artistName.toLowerCase())
    if (found) setArtist({ name: found[0], ...found[1] })
    setSongs(allSongs.filter(s => s.artist.toLowerCase() === artistName.toLowerCase()))
  }, [artistName, allSongs, allArtists, musicDataLoading])

  if (!artist) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-white/30 animate-pulse">Loading...</div>
    </div>
  )

  const followed = isArtistFollowed(artist.name)

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
      <div className="sticky top-0 z-10 glass px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-white text-2xl press-scale"><IoArrowBack /></button>
        <h1 className="text-lg font-bold text-white truncate">{artist.name}</h1>
      </div>

      <div className="px-4 pt-6 flex flex-col items-center">
        <img src={artist.image || 'https://via.placeholder.com/200'} alt={artist.name} className="w-40 h-40 rounded-full object-cover shadow-2xl mb-4" />
        <h1 className="text-3xl font-black text-white text-center mb-4">{artist.name}</h1>
        
        <div className="flex gap-4 mb-6">
          <button 
            onClick={() => toggleFollowArtist(artist.name)}
            className={`px-6 py-2 rounded-full font-bold transition-all press-scale ${
              followed 
                ? 'bg-brand-300/10 border border-brand-300 text-brand-300' 
                : 'border border-white/30 text-white hover:border-white'
            }`}
          >
            {followed ? 'Following' : 'Follow'}
          </button>
          <button 
            onClick={() => songs.length > 0 && play(songs[0], songs)}
            className="w-10 h-10 rounded-full bg-brand-300 flex items-center justify-center text-black text-xl press-scale"
          >
            <IoPlay className="ml-0.5" />
          </button>
        </div>

        <p className="text-white/60 text-sm text-center mb-8 px-4 line-clamp-3">
          {artist.bio}
        </p>
      </div>

      <div className="px-4 mb-4">
        <h2 className="text-xl font-bold text-white">Popular Tracks</h2>
      </div>
      <div className="flex flex-col">
        {songs.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} allTracks={songs} />
        ))}
      </div>
    </motion.div>
  )
}
