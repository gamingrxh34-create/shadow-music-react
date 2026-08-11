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
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-max max-w-[90%] pointer-events-none"
        >
          <div className="bg-[#2A2A2A] text-white px-5 py-3 rounded-full shadow-lg border border-white/10 text-center font-medium text-sm glass-strong">
            {toastMessage}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Toast
