import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import BottomSheet from '../components/BottomSheet'
import { IoCheckmark } from 'react-icons/io5'

function Login() {
  const { signInWithGoogle, continueAsGuest } = useAuth()
  const [isChecked, setIsChecked] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleGoogleSignIn = async () => {
    if (!isChecked || isSigningIn) return
    setIsSigningIn(true)
    setErrorMessage('')
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Google Sign-In failed:', err)
      const msg = err?.message || err?.code || 'Sign in was cancelled or failed. Please try again.'
      setErrorMessage(msg)
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-between py-16 px-8 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 bg-surface-500">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-brand-300/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-300/3 blur-[100px]" />
      </div>

      {/* Top Section - Logo */}
      <div className="relative z-10 flex flex-col items-center pt-12">
        {/* Logo Circle */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 flex items-center justify-center mb-8 glow-teal">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-surface-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
      </div>

      {/* Middle Section - Tagline */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <h1 className="text-[42px] leading-tight font-black text-white mb-4">
          Your Music.<br/>Your Shadow.
        </h1>
        <p className="text-white/50 text-base max-w-[280px]">
          Stream your favorite songs, discover new artists, and build your perfect playlists.
        </p>
      </div>

      {/* Bottom Section - Auth Buttons */}
      <div className="relative z-10 w-full max-w-sm flex flex-col gap-5 pb-8">
        
        {/* Error Notification */}
        {errorMessage && (
          <div className="w-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl text-center leading-relaxed">
            <span className="font-semibold block mb-0.5">⚠️ Sign-In Issue</span>
            {errorMessage}
          </div>
        )}

        {/* Terms Checkbox */}
        <div 
          className="flex items-start gap-3 cursor-pointer group"
          onClick={() => setIsChecked(!isChecked)}
        >
          <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-colors ${
            isChecked 
              ? 'bg-brand-300 border-brand-300' 
              : 'border-white/30 bg-white/5 group-hover:border-brand-300/50'
          }`}>
            {isChecked && <IoCheckmark className="text-black text-lg" />}
          </div>
          <div className="text-xs text-white/60 leading-relaxed">
            I agree to the <button onClick={(e) => { e.stopPropagation(); setShowModal(true); }} className="text-brand-300 underline font-semibold focus:outline-none">Terms of Service & Privacy Policy</button>
          </div>
        </div>

        {/* Continue with Google */}
        <button
          onClick={handleGoogleSignIn}
          disabled={!isChecked || isSigningIn}
          className={`w-full flex items-center justify-center gap-3 font-semibold py-4 px-6 rounded-full transition-all duration-300 ${
            isChecked && !isSigningIn
              ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98] shadow-lg shadow-white/10' 
              : 'bg-white/10 text-white/40 cursor-not-allowed'
          }`}
        >
          {isSigningIn ? (
            <div className="flex items-center gap-2 text-black">
              <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Connecting to Google...</span>
            </div>
          ) : (
            <>
              {/* Google SVG Icon */}
              <svg className={`w-5 h-5 ${!isChecked && 'opacity-40 grayscale'}`} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Continue as Guest */}
        <button
          onClick={continueAsGuest}
          disabled={!isChecked || isSigningIn}
          className={`w-full flex items-center justify-center gap-3 font-semibold py-4 px-6 rounded-full transition-all duration-300 border ${
            isChecked && !isSigningIn
              ? 'bg-transparent border-brand-300 text-brand-300 hover:bg-brand-300/10 active:scale-[0.98]' 
              : 'border-white/10 text-white/40 cursor-not-allowed'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Continue as Guest
        </button>
      </div>

      {/* Strict Policy Modal */}
      <BottomSheet isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="px-2 pb-6">
          <h2 className="text-xl font-black text-white mb-6 tracking-tight">Terms of Service & Data Policy</h2>
          
          <div className="space-y-4 text-xs text-white/70 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <h3 className="text-brand-300 font-bold mb-1 text-sm">1. Explicit Content Acknowledgment</h3>
              <p>By using Shadow Music, you explicitly acknowledge and agree that certain songs, audio tracks, artist materials, album artworks, and user-generated metadata available on the platform may contain explicit language, suggestive themes, mature concepts, or sensitive content. You agree that your access to and consumption of such content is entirely voluntary.</p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <h3 className="text-brand-300 font-bold mb-1 text-sm">2. Non-Commercial Personal Entertainment</h3>
              <p>Shadow Music is provided strictly as a demonstration platform and non-commercial personal entertainment tool. All audio streams, images, and brand identifiers remain the intellectual property of their respective creators and copyright owners. You agree not to redistribute, rebroadcast, sell, or commercially exploit any media accessed via this app.</p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <h3 className="text-brand-300 font-bold mb-1 text-sm">3. Data Collection & Privacy</h3>
              <p>We respect your privacy. If you choose to sign in using Google, we only collect your public display name, email address, and profile avatar to synchronize your library, created playlists, and favorite tracks securely in Firebase Cloud Firestore. We do not sell, rent, or distribute your personal information to third parties.</p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <h3 className="text-brand-300 font-bold mb-1 text-sm">4. Guest Usage Limitations</h3>
              <p>Users who choose the &quot;Continue as Guest&quot; option may experience local-only caching of favorites and playlists. Guest accounts do not support cross-device synchronization. Clearing your app cache or uninstalling will permanently remove guest data.</p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <h3 className="text-brand-300 font-bold mb-1 text-sm">5. Termination & App Availability</h3>
              <p>Shadow Music reserves the right to modify, suspend, or terminate services, or remove specific songs or features at any time without prior notice. Continued use of the application indicates your acceptance of these terms.</p>
            </div>
          </div>

          <button 
            onClick={() => {
              setIsChecked(true)
              setShowModal(false)
            }}
            className="w-full mt-6 bg-brand-300 text-black font-bold py-3.5 rounded-full active:scale-[0.98] transition-transform"
          >
            I Agree & Accept Terms
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

export default Login
