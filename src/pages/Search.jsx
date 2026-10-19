import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import TrackRow from '../components/TrackRow'
import { IoSearch, IoClose, IoPerson } from 'react-icons/io5'

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
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } = useUserData()
  const { songs, artists } = useMusicData()
  const navigate = useNavigate()

  const q = query.trim().toLowerCase()

  const filteredArtists = q
    ? Object.entries(artists).filter(([name]) => name.toLowerCase().includes(q)).map(([name, data]) => ({ name, ...data }))
    : []

  const filtered = q
    ? songs.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
      )
    : []

  const moodFiltered = activeMood
    ? songs.filter(s => {
        const searchText = `${s.title} ${s.artist} ${s.album} ${s.genre || ''}`.toLowerCase()
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

  return (
    <div className="page-enter px-4" style={{ paddingTop: 'calc(max(44px, env(safe-area-inset-top, 0px)) + 14px)' }}>
      <h1 className="text-2xl font-bold text-white mb-5">Search</h1>

      <div className="relative mb-6">
        <IoSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-lg" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Songs, artists, or albums"
          className="w-full bg-white/[0.08] text-white placeholder:text-white/30 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium outline-none focus:bg-white/[0.12] focus:ring-1 focus:ring-brand-300/30 transition-all"
        />
      </div>

      {query.trim() ? (
        <div className="flex flex-col">

          {/* Artist Results */}
          {filteredArtists.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 px-1">Artists</h3>
              <div className="flex flex-col gap-2">
                {filteredArtists.map(artist => (
                  <motion.div
                    key={artist.name}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors"
                  >
                    {artist.image ? (
                      <img src={artist.image} alt={artist.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <IoPerson className="text-white/40 text-xl" />
                      </div>
                    )}
                    <div>
                      <div className="text-white font-semibold text-sm">{artist.name}</div>
                      <div className="text-white/40 text-xs">Artist</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Song Results */}
          {filtered.length > 0 && (
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 px-1">Songs</h3>
          )}
          {filtered.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} allTracks={filtered} />
          ))}

          {filteredArtists.length === 0 && filtered.length === 0 && (
            <motion.div 
              className="text-center py-16"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-white/30 text-lg font-medium">No results found</div>
              <div className="text-white/20 text-sm mt-2">Try different keywords</div>
            </motion.div>
          )}
        </div>
      ) : (
        <div>
          {recentSearches.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Recent Searches</h3>
                <button onClick={clearRecentSearches} className="text-xs text-brand-300 font-semibold">Clear all</button>
              </div>
              <div className="flex flex-col gap-1 mb-8">
                {recentSearches.map((term) => (
                  <div key={term} className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <IoSearch className="text-white/40 text-lg flex-shrink-0" />
                    <span onClick={() => handleSearch(term)} className="flex-1 text-white font-medium">{term}</span>
                    <button onClick={() => removeRecentSearch(term)} className="text-white/30 hover:text-white/60 press-scale">
                      <IoClose className="text-lg" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Category Chips */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Browse by Mood</h3>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <motion.button
                  key={cat.name}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveMood(activeMood?.name === cat.name ? null : cat)}
                  className={`glass rounded-xl p-4 text-left bg-gradient-to-br ${cat.color} border transition-colors ${
                    activeMood?.name === cat.name ? 'border-brand-300/60' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{cat.emoji}</div>
                  <div className="text-sm font-bold text-white">{cat.name}</div>
                  {activeMood?.name === cat.name && (
                    <div className="text-[10px] text-brand-300 mt-1">{moodFiltered.length} songs</div>
                  )}
                </motion.button>
              ))}
            </div>
            {activeMood && (
              <div className="mt-5">
                <h4 className="text-sm font-semibold text-white/50 mb-3">{activeMood.emoji} {activeMood.name} — {moodFiltered.length} songs</h4>
                {moodFiltered.length > 0 ? (
                  <div className="flex flex-col">
                    {moodFiltered.map((track, i) => (
                      <TrackRow key={track.id} track={track} index={i} allTracks={moodFiltered} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/30 text-sm">No songs found for this mood yet</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Search
