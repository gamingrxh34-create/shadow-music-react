import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePlayer } from '../contexts/PlayerContext'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import MediaCard from '../components/MediaCard'
import { IoSettingsOutline, IoClose } from 'react-icons/io5'
import SettingsModal from '../components/SettingsModal'
import Skeleton from '../components/Skeleton'

function Home() {
  const { user } = useAuth()
  const { play } = usePlayer()
  const { recentHistory, removeFromHistory } = useUserData()
  const { songs: allSongs, artists: allArtists } = useMusicData()
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  const firstName = user?.displayName?.split(' ')[0] || 'User'
  
  const recentSongs = (recentHistory || []).filter(Boolean).slice(0, 6)

  const madeForYou = allSongs && allSongs.length > 12 ? allSongs.slice(0, 20) : (allSongs || [])
  const artistList = Object.entries(allArtists || {}).map(([name, data]) => ({
    name,
    image: data?.image || '',
    subtitle: 'Artist'
  }))

  return (
    <div className="page-enter px-4" style={{ paddingTop: 'calc(max(44px, env(safe-area-inset-top, 0px)) + 14px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 z-10 relative">
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, <span className="text-brand-300">{firstName}</span>
        </h1>
        <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-full overflow-hidden border border-white/10 press-scale flex-shrink-0 bg-brand-500/20">
          <img 
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=38d1b0&color=050505&bold=true`} 
            alt="Profile" 
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=38d1b0&color=050505&bold=true`;
            }}
            className="w-full h-full object-cover" 
          />
        </button>
      </div>

      {/* Hero Banner (Featured) */}
      {allSongs && allSongs.length > 0 && allSongs[0] && (
        <div className="relative h-56 rounded-2xl overflow-hidden mb-8 shadow-xl press-scale cursor-pointer group" onClick={() => play(allSongs[0], allSongs)}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />
          <img 
            src={allSongs[0].coverUrl || 'https://via.placeholder.com/300'} 
            alt={allSongs[0].title || ''}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 p-5 flex flex-col justify-end z-20">
            <div className="text-[10px] font-black tracking-widest text-brand-300 uppercase mb-2">New Release</div>
            <h2 className="text-2xl font-bold text-white mb-1 truncate">{allSongs[0].title}</h2>
            <p className="text-sm text-white/70 truncate mb-4">{allSongs[0].artist}</p>
            <div className="w-10 h-10 rounded-full bg-brand-300 flex items-center justify-center text-black pl-1 shadow-[0_0_20px_rgba(100,255,218,0.4)]">
              <IoSettingsOutline className="hidden" /> {/* Temp hidden, used for importing */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
      )}

      {/* Continue Listening */}
      {recentSongs.length > 0 && (
        <section className="mb-8">
          <div className="text-[10px] font-black tracking-widest text-brand-300 uppercase mb-1">Pick Up Where You Left Off</div>
          <h2 className="text-xl font-bold text-white mb-4">Continue Listening</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
            {recentSongs.map((song) => {
              // Mock progress between 10% and 90% for visual effect
              const mockProgress = Math.floor(Math.random() * 80) + 10;
              return (
                <div
                  key={song.id}
                  className="relative min-w-[140px] max-w-[140px] glass rounded-xl overflow-hidden cursor-pointer hover:bg-white/[0.08] transition-colors press-scale group"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromHistory(song.id) }}
                    className="absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <IoClose className="text-xs" />
                  </button>
                  <div onClick={() => play(song, recentSongs)} className="absolute inset-0 z-10" />
                  <div className="relative aspect-square">
                    <img src={song.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white pl-1">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-[13px] font-semibold text-white truncate mb-1">{song.title}</div>
                    <div className="text-[11px] text-white/50 truncate mb-3">{song.artist}</div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-300 rounded-full" style={{ width: `${mockProgress}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Made for You */}
      <section className="mb-8">
        <div className="text-[10px] font-black tracking-widest text-brand-300 uppercase mb-1">Personalized For You</div>
        <h2 className="text-xl font-bold text-white mb-4">Made for You</h2>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4">
          {allSongs.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[150px] max-w-[150px]">
                <Skeleton className="w-full aspect-square rounded-xl mb-3" />
                <Skeleton className="w-3/4 h-4 mb-2" />
                <Skeleton className="w-1/2 h-3" />
              </div>
            ))
          ) : (
            madeForYou.map((song) => (
              <div key={song.id} className="min-w-[150px] max-w-[150px]">
                <MediaCard item={song} type="song" allTracks={madeForYou} />
              </div>
            ))
          )}
          <div className="w-4 shrink-0" />
        </div>
      </section>

      {/* Top Artists */}
      <section className="mb-8">
        <div className="text-[10px] font-black tracking-widest text-brand-300 uppercase mb-1">Trending Now</div>
        <h2 className="text-xl font-bold text-white mb-4">Top Artists</h2>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4">
          {Object.keys(allArtists).length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[130px] max-w-[130px] flex flex-col items-center">
                <Skeleton className="w-[130px] h-[130px] rounded-full mb-3" />
                <Skeleton className="w-3/4 h-4" />
              </div>
            ))
          ) : (
            artistList.map((artist) => (
              <div key={artist.name} className="min-w-[130px] max-w-[130px]">
                <MediaCard item={artist} type="artist" />
              </div>
            ))
          )}
          <div className="w-4 shrink-0" />
        </div>
      </section>
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <div className="h-12" />
    </div>
  )
}

export default Home
