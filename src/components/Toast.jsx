import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../contexts/ToastContext'

function Toast() {
  const { toastMessage, hideToast } = useToast()

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        hideToast()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [toastMessage, hideToast])

  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          initial={{ y: -40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -30, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[150] pointer-events-none flex justify-center px-4"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
        >
          <div className="bg-white text-black px-6 py-3.5 rounded-full shadow-2xl font-bold text-sm flex items-center justify-center max-w-md w-auto mx-auto border border-white/20">
            {toastMessage}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Toast
