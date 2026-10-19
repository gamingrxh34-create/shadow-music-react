import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import { IoCheckmarkCircle, IoCheckmark, IoArrowBack, IoClose } from 'react-icons/io5'

export default function Onboarding() {
  const navigate = useNavigate()
  const { followedArtists, toggleFollowArtist, completeOnboarding } = useUserData()
  const { artists: allArtists } = useMusicData()
  const [isFinishing, setIsFinishing] = useState(false)

  // Use pure Firestore artists taken from database
  const artistList = useMemo(() => {
    return Object.entries(allArtists || {}).map(([name, data]) => ({
      name,
      ...data
    }))
  }, [allArtists])

  const requiredCount = 3
  const currentCount = followedArtists.length
  const progressPercent = Math.min((currentCount / requiredCount) * 100, 100)

  const handleFinish = async () => {
    if (isFinishing) return
    setIsFinishing(true)
    await completeOnboarding()
    navigate('/home', { replace: true })
  }

  return (
    <motion.div 
      className="fixed inset-0 flex flex-col bg-[#050505] z-[200]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Top Header with Back / Skip controls */}
      <div className="flex-shrink-0 z-20 glass px-6 pt-12 pb-5 border-b border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={handleFinish} 
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium py-1 px-2.5 rounded-full bg-white/5 active:scale-95 transition-all"
          >
            <IoArrowBack className="text-base" />
            <span>Back</span>
          </button>

          <button 
            onClick={handleFinish}
            className="text-white/60 hover:text-brand-300 text-sm font-semibold py-1 px-3 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
          >
            Skip
          </button>
        </div>

        <motion.h1 
          className="text-3xl font-black text-white leading-tight mb-2"
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Pick your <br/><span className="text-brand-300">favorite artists</span>
        </motion.h1>
        
        <motion.p 
          className="text-white/60 text-sm mb-4"
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Select artists you love to personalize your home feed, or skip for now.
        </motion.p>
        
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-brand-300 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          />
        </div>
      </div>

      {/* Artist Grid */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-36 hide-scrollbar">
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          {artistList.map((artist, index) => {
            const isSelected = followedArtists.includes(artist.name)
            return (
              <motion.div
                key={artist.name}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 + (index * 0.03), type: 'spring' }}
                className="flex flex-col items-center"
              >
                <div 
                  onClick={() => toggleFollowArtist(artist.name)}
                  className="relative cursor-pointer group mb-2"
                >
                  <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden transition-all duration-300 press-scale ${isSelected ? 'ring-4 ring-brand-300 ring-offset-4 ring-offset-[#050505]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                    <img 
                      src={artist.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80'} 
                      alt={artist.name} 
                      className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}
                    />
                    {/* Selected Overlay */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div 
                          className="absolute inset-0 bg-black/40 flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring', bounce: 0.5 }}
                          >
                            <IoCheckmarkCircle className="text-brand-300 text-4xl" />
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <span className={`text-xs font-bold text-center w-full truncate px-1 transition-colors ${isSelected ? 'text-brand-300' : 'text-white'}`}>
                  {artist.name}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Floating Bottom Button (Always available so user is NEVER stuck!) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-black via-black/90 to-transparent flex justify-center z-30 pointer-events-none">
        <button
          onClick={handleFinish}
          disabled={isFinishing}
          className={`w-full max-w-sm font-bold text-base py-4 rounded-full press-scale flex items-center justify-center gap-2 pointer-events-auto transition-all duration-300 ${
            currentCount > 0 
              ? 'bg-brand-300 text-black shadow-[0_0_35px_rgba(100,255,218,0.35)]' 
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
          } disabled:opacity-50`}
        >
          {isFinishing ? (
            <span className="animate-pulse">Loading App...</span>
          ) : currentCount > 0 ? (
            <>
              <span>Continue ({currentCount} selected)</span>
              <IoCheckmark className="text-xl" />
            </>
          ) : (
            <span>Continue to App</span>
          )}
        </button>
      </div>
    </motion.div>
  )
}
