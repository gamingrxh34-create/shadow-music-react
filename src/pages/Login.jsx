import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import BottomSheet from '../components/BottomSheet'
import { IoCheckmark } from 'react-icons/io5'

function Login() {
  const { signInWithGoogle, continueAsGuest } = useAuth()
  const [isChecked, setIsChecked] = useState(false)
  const [showModal, setShowModal] = useState(false)

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
          onClick={signInWithGoogle}
          disabled={!isChecked}
          className={`w-full flex items-center justify-center gap-3 font-semibold py-4 px-6 rounded-full transition-all duration-300 ${
            isChecked 
              ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98] shadow-lg shadow-white/10' 
              : 'bg-white/10 text-white/40 cursor-not-allowed'
          }`}
        >
          {/* Google SVG Icon */}
          <svg className={`w-5 h-5 ${!isChecked && 'opacity-40 grayscale'}`} viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Continue as Guest */}
        <button
          onClick={continueAsGuest}
          disabled={!isChecked}
          className={`w-full flex items-center justify-center gap-3 font-semibold py-4 px-6 rounded-full transition-all duration-300 border ${
            isChecked 
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
          
          <div className="space-y-6 text-sm text-white/70 leading-relaxed">
            <section>
              <h3 className="text-brand-300 font-bold mb-2 uppercase tracking-wide text-xs">1. Offline Storage</h3>
              <p>Shadow Music stores cached audio files and app data on your device to enable offline playback and a smooth experience. Storage usage depends on the number of songs you download.</p>
            </section>

            <section>
              <h3 className="text-brand-300 font-bold mb-2 uppercase tracking-wide text-xs">2. Background Playback</h3>
              <p>This app uses background audio playback so music continues when your screen is off or you switch apps. This is standard for music apps and may use additional battery.</p>
            </section>

            <section>
              <h3 className="text-brand-300 font-bold mb-2 uppercase tracking-wide text-xs">3. Data & Personalization</h3>
              <p>We collect listening history and library preferences to personalize your experience, sync across devices, and improve recommendations. Your data is stored securely on Firebase servers.</p>
            </section>

            <section>
              <h3 className="text-brand-300 font-bold mb-2 uppercase tracking-wide text-xs">4. Limitation of Liability</h3>
              <p>The developers of Shadow Music provide this service "as is" and shall bear zero liability for data loss, corrupted files, excessive cellular data consumption, or any direct/indirect damages arising from the use of this application.</p>
            </section>
          </div>

          <button 
            onClick={() => { setShowModal(false); setIsChecked(true); }}
            className="w-full mt-8 bg-brand-300 text-black font-bold py-4 rounded-xl press-scale"
          >
            I Accept & Agree
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

export default Login
