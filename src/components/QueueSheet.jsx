import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { usePlayer } from '../contexts/PlayerContext'
import { IoClose, IoMenu, IoTrashOutline } from 'react-icons/io5'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export default function QueueSheet({ isOpen, onClose }) {
  const { queue, currentIndex, reorderQueue, removeFromQueue, currentTrack, play } = usePlayer()
  const [localQueue, setLocalQueue] = useState([])
  const dragControls = useDragControls()

  // Sync local queue when sheet opens or context queue changes
  useEffect(() => {
    setLocalQueue(queue || [])
  }, [queue])

  const offset = currentIndex + 1
  const upcoming = localQueue.slice(offset)

  const handleDragEnd = (result) => {
    if (!result.destination) return

    const sourceIndex = result.source.index
    const destinationIndex = result.destination.index

    if (sourceIndex === destinationIndex) return

    // Reorder locally first for instant feedback
    const newUpcoming = Array.from(upcoming)
    const [moved] = newUpcoming.splice(sourceIndex, 1)
    newUpcoming.splice(destinationIndex, 0, moved)
    setLocalQueue([...localQueue.slice(0, offset), ...newUpcoming])
    
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})

    // Then update context with absolute indices
    if (reorderQueue) {
      reorderQueue(sourceIndex + offset, destinationIndex + offset)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[110]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y > 100 || velocity.y > 500) {
                Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
                onClose()
              }
            }}
            className="fixed inset-x-0 bottom-0 top-[15vh] bg-surface-100 z-[120] rounded-t-3xl overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10"
          >
            {/* Handle bar for dragging */}
            <div 
              className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" 
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">Up Next</h2>
              <button onClick={onClose} className="text-white/50 text-2xl press-scale">
                <IoClose />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {/* Currently Playing */}
              {currentTrack && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-brand-300 mb-3 px-2">Now Playing</h3>
                  <div className="flex items-center gap-3 bg-white/[0.08] p-3 rounded-xl border border-brand-300/20">
                    <img src={currentTrack.coverUrl} alt="" className="w-12 h-12 rounded-md object-cover shadow-lg" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{currentTrack.title}</div>
                      <div className="text-xs text-white/50 truncate">{currentTrack.artist}</div>
                    </div>
                    <div className="flex gap-1 items-end h-4 mr-2">
                      <span className="w-1 bg-brand-300 rounded-full animate-[playingBounce_1s_ease-in-out_infinite]" style={{ animationDelay: '-0.4s' }} />
                      <span className="w-1 bg-brand-300 rounded-full animate-[playingBounce_1s_ease-in-out_infinite]" style={{ animationDelay: '-0.2s' }} />
                      <span className="w-1 bg-brand-300 rounded-full animate-[playingBounce_1s_ease-in-out_infinite]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Next in Queue */}
              <h3 className="text-sm font-bold text-white/50 mb-3 px-2">Next in Queue</h3>
              
              {upcoming.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">
                  Queue is empty.
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="queue-list">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="flex flex-col gap-1"
                      >
                        {upcoming.map((track, i) => (
                          <Draggable key={`${track.id}-${i}`} draggableId={`${track.id}-${i}`} index={i}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                                  snapshot.isDragging ? 'bg-brand-900/50 shadow-xl border border-brand-300/30' : 'hover:bg-white/[0.04]'
                                }`}
                              >
                                <div {...provided.dragHandleProps} className="text-white/30 p-2 -ml-2 cursor-grab active:cursor-grabbing">
                                  <IoMenu className="text-xl" />
                                </div>
                                
                                <img src={track.coverUrl} alt="" className="w-10 h-10 rounded-md object-cover" />
                                
                                <div 
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => play(track, localQueue)}
                                >
                                  <div className="text-sm font-semibold text-white truncate">{track.title}</div>
                                  <div className="text-xs text-white/50 truncate">{track.artist}</div>
                                </div>

                                <button
                                  onClick={() => removeFromQueue && removeFromQueue(i + offset)}
                                  className="text-white/30 p-2 press-scale hover:text-red-400"
                                >
                                  <IoTrashOutline className="text-lg" />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
