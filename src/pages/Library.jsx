import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useUserData } from '../contexts/UserDataContext'
import { useDownload } from '../contexts/DownloadContext'
import { useMusicData } from '../contexts/MusicDataContext'
import { IoSearch, IoAdd, IoHeart, IoClose, IoMusicalNotes } from 'react-icons/io5'
import Skeleton from '../components/Skeleton'
import TrackRow from '../components/TrackRow'

const filters = ['Playlists', 'Artists', 'Downloads']

function Library() {
  const { user } = useAuth()
  const { likedSongIds, followedArtists, playlists, createPlaylist } = useUserData()
  const { downloadedSongs } = useDownload()
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('Playlists')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const { songs, artists, loading } = useMusicData()

  const followedArtistData = followedArtists.map(name => ({
    name,
    image: artists[name]?.image || '',
    bio: artists[name]?.bio || ''
  }))

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return
    await createPlaylist(newPlaylistName)
    setNewPlaylistName('')
    setShowCreateModal(false)
  }

  // Find cover URL for a playlist (use first song's cover)
  const getPlaylistCover = (playlist) => {
    if (playlist.songIds.length === 0) return null
    const firstSong = songs.find(s => s.id === playlist.songIds[0])
    return firstSong?.coverUrl || null
  }

  return (
    <div className="page-enter px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <img
            src={user?.photoURL || 'https://via.placeholder.com/40'}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
          />
          <h1 className="text-2xl font-bold text-white">Your Library</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/search')} className="text-white/50 text-xl press-scale hover:text-white transition-colors"><IoSearch /></button>
          <button onClick={() => setShowCreateModal(true)} className="text-white/50 text-xl press-scale hover:text-white transition-colors"><IoAdd /></button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6 -mx-4 px-4">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors press-scale ${
              activeFilter === filter
                ? 'bg-brand-300 text-black'
                : 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Playlists Tab */}
      {activeFilter === 'Playlists' && (
        <div className="flex flex-col">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-2">
                <Skeleton className="w-14 h-14 rounded-md flex-shrink-0" />
                <div className="w-full">
                  <Skeleton className="w-32 h-4 mb-2" />
                  <Skeleton className="w-24 h-3" />
                </div>
              </div>
            ))
          ) : (
            <>
              {/* Liked Songs Row */}
              <div
                onClick={() => navigate('/playlist/liked')}
                className="flex items-center gap-3 py-3 cursor-pointer hover:bg-white/5 active:bg-white/[0.08] rounded-lg px-2 transition-colors"
              >
                <div className="w-14 h-14 rounded-md bg-gradient-to-br from-brand-300/80 to-brand-700 flex items-center justify-center flex-shrink-0">
                  <IoHeart className="text-white text-2xl" />
                </div>
                <div>
                  <div className="text-base font-semibold text-white">Liked Songs</div>
                  <div className="text-sm text-white/50">Playlist • {likedSongIds.length} songs</div>
                </div>
              </div>

              {/* User Playlists */}
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  onClick={() => navigate(`/playlist/${playlist.id}`)}
                  className="flex items-center gap-3 py-3 cursor-pointer hover:bg-white/5 active:bg-white/[0.08] rounded-lg px-2 transition-colors"
                >
                  {getPlaylistCover(playlist) ? (
                    <img src={getPlaylistCover(playlist)} alt="" className="w-14 h-14 rounded-md object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-white/[0.08] flex items-center justify-center">
                      <IoMusicalNotes className="text-white/40 text-xl" />
                    </div>
                  )}
                  <div>
                    <div className="text-base font-semibold text-white">{playlist.name}</div>
                    <div className="text-sm text-white/50">Playlist • {playlist.songIds.length} songs</div>
                  </div>
                </div>
              ))}

              {playlists.length === 0 && (
                <motion.div 
                  className="text-center py-16 flex flex-col items-center"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <IoMusicalNotes className="text-white/15 text-5xl mb-4" />
                  <div className="text-white/30 text-lg font-medium">No playlists yet</div>
                  <div className="text-white/20 text-sm mt-2 mb-6">Create a playlist to organize your music</div>
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-2 rounded-full bg-white/10 text-white font-semibold press-scale hover:bg-white/20 transition-colors flex items-center gap-2"
                  >
                    <IoAdd className="text-lg" />
                    <span>Create Playlist</span>
                  </button>
                </motion.div>
              )}
            </>
          )}
        </div>
      )}

      {/* Artists Tab */}
      {activeFilter === 'Artists' && (
        <div className="flex flex-col">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-2">
                <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
                <div className="w-full">
                  <Skeleton className="w-32 h-4 mb-2" />
                  <Skeleton className="w-24 h-3" />
                </div>
              </div>
            ))
          ) : followedArtistData.length === 0 ? (
            <motion.div 
              className="text-center py-16 flex flex-col items-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <IoHeart className="text-white/15 text-3xl" />
              </div>
              <div className="text-white/30 text-lg font-medium">No followed artists</div>
              <div className="text-white/20 text-sm mt-2 mb-6">Follow your favorite artists to stay updated</div>
              <button 
                onClick={() => navigate('/home')}
                className="px-6 py-2 rounded-full bg-white/10 text-white font-semibold press-scale hover:bg-white/20 transition-colors"
              >
                Discover Artists
              </button>
            </motion.div>
          ) : (
            followedArtistData.map((artist) => (
              <div
                key={artist.name}
                onClick={() => navigate(`/artist/${artist.name}`)}
                className="flex items-center gap-3 py-3 cursor-pointer hover:bg-white/5 active:bg-white/[0.08] rounded-lg px-2 transition-colors"
              >
                <img
                  src={artist.image || 'https://via.placeholder.com/56'}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover bg-white/5"
                />
                <div>
                  <div className="text-base font-semibold text-white">{artist.name}</div>
                  <div className="text-sm text-white/50">Artist</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Downloads Tab */}
      {activeFilter === 'Downloads' && (
        <div className="flex flex-col pb-24">
          {Object.keys(downloadedSongs).length === 0 ? (
            <motion.div 
              className="text-center py-16 flex flex-col items-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <IoAdd className="text-white/15 text-3xl transform rotate-180" />
              </div>
              <div className="text-white/30 text-lg font-medium">No downloads yet</div>
              <div className="text-white/20 text-sm mt-2 mb-6">Download songs to listen offline</div>
              <button 
                onClick={() => navigate('/search')}
                className="px-6 py-2 rounded-full bg-white/10 text-white font-semibold press-scale hover:bg-white/20 transition-colors"
              >
                Find Songs
              </button>
            </motion.div>
          ) : (
            <div className="flex flex-col">
              {songs
                .filter(song => downloadedSongs[song.id])
                .map((track, index) => (
                  <TrackRow 
                    key={track.id} 
                    track={track} 
                    index={index} 
                    allTracks={songs.filter(s => downloadedSongs[s.id])} 
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative glass-strong rounded-2xl p-6 w-[85%] max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Create Playlist</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white/50 text-xl"><IoClose /></button>
            </div>
            <input
              type="text"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
              placeholder="Playlist name"
              autoFocus
              className="w-full bg-white/[0.08] text-white placeholder:text-white/30 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:ring-1 focus:ring-brand-300/30 mb-4"
            />
            <button
              onClick={handleCreatePlaylist}
              disabled={!newPlaylistName.trim()}
              className="w-full py-3 rounded-full bg-brand-300 text-black font-bold press-scale disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Library
