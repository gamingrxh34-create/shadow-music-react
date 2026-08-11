import { useState } from 'react'
import { motion } from 'framer-motion'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import TrackRow from '../components/TrackRow'
import { IoSearch, IoClose } from 'react-icons/io5'

const categories = [
  { name: 'Chill', emoji: '🌊', color: 'from-cyan-500/20 to-blue-600/20' },
  { name: 'Workout', emoji: '🔥', color: 'from-orange-500/20 to-red-600/20' },
  { name: 'Party', emoji: '🎉', color: 'from-purple-500/20 to-pink-600/20' },
  { name: 'Late Night', emoji: '🌙', color: 'from-indigo-500/20 to-violet-600/20' },
  { name: 'Sad', emoji: '💔', color: 'from-slate-500/20 to-gray-600/20' },
  { name: 'Hype', emoji: '⚡', color: 'from-yellow-500/20 to-amber-600/20' },
]

function Search() {
  const [query, setQuery] = useState('')
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } = useUserData()
  const { songs } = useMusicData()

  const filtered = query.trim()
    ? songs.filter(s =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase()) ||
        s.album.toLowerCase().includes(query.toLowerCase())
      )
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
    <div className="page-enter px-4 pt-6">
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
          <h3 className="text-sm font-semibold text-white/50 mb-3 px-1">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </h3>
          {filtered.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} allTracks={filtered} />
          ))}
          {filtered.length === 0 && (
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
                  onClick={() => handleSearch(cat.name)}
                  className={`glass rounded-xl p-4 text-left bg-gradient-to-br ${cat.color} border border-white/5 hover:border-white/10 transition-colors`}
                >
                  <div className="text-2xl mb-2">{cat.emoji}</div>
                  <div className="text-sm font-bold text-white">{cat.name}</div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Search
