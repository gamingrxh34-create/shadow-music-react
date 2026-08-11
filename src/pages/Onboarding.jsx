import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserData } from '../contexts/UserDataContext'
import { useMusicData } from '../contexts/MusicDataContext'
import { IoCheckmarkCircle, IoCheckmark } from 'react-icons/io5'

export default function Onboarding() {
  const navigate = useNavigate()
  const { followedArtists, toggleFollowArtist, completeOnboarding } = useUserData()
  const { artists: allArtists, loading } = useMusicData()
  const [isFinishing, setIsFinishing] = useState(false)

  // Get a random selection of 15 artists to display
  const artistList = useMemo(() => {
    if (!allArtists || Object.keys(allArtists).length === 0) return []
    return Object.entries(allArtists)
      .map(([name, data]) => ({ name, ...data }))
      .sort(() => 0.5 - Math.random()) // Randomize for fresh onboarding
      .slice(0, 15)
  }, [allArtists])

  const requiredCount = 3
  const currentCount = followedArtists.length
  const progressPercent = Math.min((currentCount / requiredCount) * 100, 100)

  const handleFinish = async () => {
    setIsFinishing(true)
    await completeOnboarding()
    navigate('/home')
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#050505]">
        <div className="text-brand-300 animate-pulse font-medium uppercase tracking-widest text-sm">Loading Artists...</div>
      </div>
    )
  }

  return (
    <motion.div 
      className="fixed inset-0 flex flex-col bg-[#050505] z-[200]" // Overlay completely
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex-shrink-0 z-20 glass px-6 pt-12 pb-6 border-b border-white/5 shadow-2xl">
        <motion.h1 
          className="text-3xl font-black text-white leading-tight mb-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Pick your <br/><span className="text-brand-300">favorite artists</span>
        </motion.h1>
        <motion.p 
          className="text-white/60 text-sm mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          We'll use this to personalize your experience. Choose {requiredCount} or more.
        </motion.p>
        
        {/* Progress bar */}
        <motion.div 
          className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div 
            className="h-full bg-brand-300 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
          />
        </motion.div>
      </div>

      {/* Artist Grid */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-32 hide-scrollbar">
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          {artistList.map((artist, index) => {
            const isSelected = followedArtists.includes(artist.name)
            return (
              <motion.div
                key={artist.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + (index * 0.05), type: 'spring' }}
                className="flex flex-col items-center"
              >
                <div 
                  onClick={() => toggleFollowArtist(artist.name)}
                  className="relative cursor-pointer group mb-2"
                >
                  <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden transition-all duration-300 press-scale ${isSelected ? 'ring-4 ring-brand-300 ring-offset-4 ring-offset-[#050505]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                    <img 
                      src={artist.image || 'https://via.placeholder.com/150'} 
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

      {/* Floating Continue Button */}
      <AnimatePresence>
        {currentCount >= requiredCount && (
          <motion.div 
            className="fixed bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-center z-30 pointer-events-none"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <button
              onClick={handleFinish}
              disabled={isFinishing}
              className="w-full max-w-sm bg-brand-300 text-black font-bold text-lg py-4 rounded-full press-scale flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(100,255,218,0.3)] disabled:opacity-50 pointer-events-auto"
            >
              {isFinishing ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <span>Continue to App</span>
                  <IoCheckmark className="text-xl" />
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
