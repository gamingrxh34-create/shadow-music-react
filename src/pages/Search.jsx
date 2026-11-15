import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import TrackRow from '../components/TrackRow'
import { IoSearch, IoClose, IoCloseCircle, IoPerson } from 'react-icons/io5'

const categories = [
  { name: 'Chill', emoji: '🌊', color: 'from-cyan-500/20 to-blue-600/20', keywords: ['chill', 'lo-fi', 'lofi', 'relax', 'calm', 'sleep', 'slow'] },
  { name: 'Workout', emoji: '🔥', color: 'from-orange-500/20 to-red-600/20', keywords: ['workout', 'gym', 'energy', 'power', 'beast', 'pump'] },
  { name: 'Party', emoji: '🎉', color: 'from-purple-500/20 to-pink-600/20', keywords: ['party', 'dance', 'club', 'disco', 'bhangra', 'dj', 'remix'] },
  { name: 'Late Night', emoji: '🌙', color: 'from-indigo-500/20 to-violet-600/20', keywords: ['night', 'midnight', 'dark', 'deep', 'sad', 'alone', 'heartbreak'] },
  { name: 'Sad', emoji: '💔', color: 'from-slate-500/20 to-gray-600/20', keywords: ['sad', 'heartbreak', 'emotional', 'cry', 'dard', 'dil', 'toot', 'judai'] },
  { name: 'Hype', emoji: '⚡', color: 'from-yellow-500/20 to-amber-600/20', keywords: ['hype', 'rap', 'hip hop', 'trap', 'swag', 'fire', 'lit', 'boss'] },
]

function Search() {
  const [query, setQuery] = useState('')
  const [activeMood, setActiveMood] = useState(null)
  const [resultFilter, setResultFilter] = useState('all') // 'all' | 'songs' | 'artists'
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } = useUserData()
  const { songs, artists } = useMusicData()
  const navigate = useNavigate()

  const q = query.trim().toLowerCase()

  const filteredArtists = q
    ? Object.entries(artists || {}).filter(([name]) => (name || '').toLowerCase().includes(q)).map(([name, data]) => ({ name, ...data }))
    : []

  const filtered = q
    ? (songs || []).filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q) ||
        (s.album || '').toLowerCase().includes(q)
      )
    : []

  const moodFiltered = activeMood
    ? (songs || []).filter(s => {
        const searchText = `${s.title || ''} ${s.artist || ''} ${s.album || ''} ${s.genre || ''}`.toLowerCase()
        return activeMood.keywords.some(kw => searchText.includes(kw))
      })
    : []

  const handleSearch = (term) => {
    setQuery(term)
    if (term.trim()) addRecentSearch(term.trim())
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      addRecentSearch(query.trim())
    }
  }

  const showArtists = resultFilter === 'all' || resultFilter === 'artists'
  const showSongs = resultFilter === 'all' || resultFilter === 'songs'

  return (
    <div className="page-enter px-4 pb-24" style={{ paddingTop: 'calc(max(44px, env(safe-area-inset-top, 0px)) + 14px)' }}>
      <h1 className="text-2xl font-bold text-white mb-5">Search</h1>

      {/* Search Input Bar with Quick Clear */}
      <div className="relative mb-4">
        <IoSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Songs, artists, or albums"
          className="w-full bg-white/[0.08] text-white placeholder:text-white/30 rounded-xl py-3.5 pl-11 pr-11 text-sm font-medium outline-none focus:bg-white/[0.12] focus:ring-1 focus:ring-brand-300/40 transition-all border border-white/5"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-lg press-scale p-1"
            title="Clear search"
          >
            <IoCloseCircle />
          </button>
        )}
      </div>

      {query.trim() ? (
        <div className="flex flex-col">
          {/* Result Filter Tabs */}
          {(filteredArtists.length > 0 || filtered.length > 0) && (
            <div className="flex items-center gap-2 mb-5">
              {[
                { id: 'all', label: `All (${filteredArtists.length + filtered.length})` },
                { id: 'songs', label: `Songs (${filtered.length})` },
                { id: 'artists', label: `Artists (${filteredArtists.length})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setResultFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors press-scale ${
                    resultFilter === tab.id
                      ? 'bg-brand-300 text-black'
                      : 'bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Artist Results */}
          {showArtists && filteredArtists.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 px-1">Artists</h3>
              <div className="flex flex-col gap-2">
                {filteredArtists.map(artist => (
                  <motion.div
                    key={artist.name}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors border border-white/5"
                  >
                    {artist.image ? (
                      <img src={artist.image} alt={artist.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <IoPerson className="text-white/40 text-xl" />
                      </div>
                    )}
                    <div>
                      <div className="text-white font-semibold text-sm">{artist.name}</div>
                      <div className="text-brand-300 text-xs font-medium">Artist</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Song Results */}
          {showSongs && filtered.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 px-1">Songs</h3>
              <div className="flex flex-col">
                {filtered.map((track, i) => (
                  <TrackRow key={track.id} track={track} index={i} allTracks={filtered} />
                ))}
              </div>
            </div>
          )}

          {filteredArtists.length === 0 && filtered.length === 0 && (
            <motion.div 
              className="text-center py-16"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-white/30 text-lg font-medium">No results found for "{query}"</div>
              <div className="text-white/20 text-sm mt-2">Check the spelling or try searching for an artist name</div>
            </motion.div>
          )}
        </div>
      ) : (
        <div>
          {recentSearches.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Recent Searches</h3>
                <button onClick={clearRecentSearches} className="text-xs text-brand-300 font-semibold hover:underline">Clear all</button>
              </div>
              <div className="flex flex-col gap-1 mb-8">
                {recentSearches.map((term) => (
                  <div key={term} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                    <IoSearch className="text-white/40 text-lg flex-shrink-0" />
                    <span onClick={() => handleSearch(term)} className="flex-1 text-white font-medium text-sm">{term}</span>
                    <button onClick={() => removeRecentSearch(term)} className="text-white/30 hover:text-white/70 press-scale p-1">
                      <IoClose className="text-lg" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Mood Categories */}
          <div className="mb-6">
            <h3 className="text-base font-bold text-white mb-4">Browse by Mood</h3>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <motion.button
                  key={cat.name}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveMood(activeMood?.name === cat.name ? null : cat)}
                  className={`glass rounded-xl p-4 text-left bg-gradient-to-br ${cat.color} border transition-colors ${
                    activeMood?.name === cat.name ? 'border-brand-300/60 ring-1 ring-brand-300/30' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{cat.emoji}</div>
                  <div className="text-sm font-bold text-white">{cat.name}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Mood Filtered Songs */}
          {activeMood && moodFiltered.length > 0 && (
            <div className="mt-6">
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span>{activeMood.emoji}</span>
                <span>{activeMood.name} Vibes</span>
              </h3>
              <div className="flex flex-col">
                {moodFiltered.map((track, i) => (
                  <TrackRow key={track.id} track={track} index={i} allTracks={moodFiltered} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Search
