import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { IoClose, IoPersonOutline, IoInformationCircleOutline, IoLogOutOutline, IoChevronForward, IoMusicalNotesOutline } from 'react-icons/io5'

export default function SettingsModal({ onClose }) {
  const { user, logout } = useAuth()
  const [activeSection, setActiveSection] = useState(null)

  const sections = {
    account: {
      title: 'Account',
      icon: IoPersonOutline,
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <img src={user?.photoURL || 'https://via.placeholder.com/80'} alt="" className="w-20 h-20 rounded-full object-cover shadow-lg" />
            <div className="text-center">
              <div className="text-xl font-bold text-white">{user?.displayName || 'User'}</div>
              <div className="text-sm text-white/50">{user?.email}</div>
            </div>
          </div>
          <div className="bg-white/5 p-4 rounded-xl">
            <div className="text-sm text-white/50">Signed in via</div>
            <div className="text-white font-semibold">Google</div>
          </div>
          <div className="bg-white/5 p-4 rounded-xl">
            <div className="text-sm text-white/50">Member since</div>
            <div className="text-white font-semibold">{user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}</div>
          </div>
        </div>
      )
    },
    request: {
      title: 'Request Songs/Artists',
      icon: IoMusicalNotesOutline,
      content: (
        <div className="flex flex-col gap-4">
          <p className="text-white/60 text-sm">Want a song or artist added to Shadow Music? Fill out the request form and we'll try to add it!</p>
          <a 
            href="https://forms.gle/shadowmusic" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full py-4 rounded-xl bg-brand-300/10 border border-brand-300/30 text-brand-300 font-bold text-center press-scale hover:bg-brand-300/20 transition-colors block"
          >
            Open Request Form
          </a>
          <p className="text-white/30 text-xs text-center">Requests are reviewed weekly</p>
        </div>
      )
    },
    about: {
      title: 'About',
      icon: IoInformationCircleOutline,
      content: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 flex items-center justify-center mb-3 glow-teal">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            <div className="text-xl font-black text-gradient">Shadow Music</div>
            <div className="text-white/40 text-sm mt-1">v2.0.0</div>
          </div>
          <div className="bg-white/5 p-4 rounded-xl">
            <div className="text-sm text-white/50">Built with</div>
            <div className="text-white font-semibold">React + Vite + Firebase</div>
          </div>
          <div className="bg-white/5 p-4 rounded-xl">
            <div className="text-sm text-white/50">Developer</div>
            <div className="text-white font-semibold">{user?.displayName || 'Shadow Music Team'}</div>
          </div>
          <div className="bg-white/5 p-4 rounded-xl">
            <div className="text-sm text-white/50">Data Source</div>
            <div className="text-white font-semibold">Cloudinary CDN</div>
          </div>
          <p className="text-center text-white/20 text-xs mt-4">Made with ❤️ for music lovers</p>
        </div>
      )
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      <div className="relative w-full sm:w-[400px] max-h-[85vh] glass-strong sm:rounded-2xl rounded-t-2xl flex flex-col animate-slide-up shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          {activeSection ? (
            <>
              <button onClick={() => setActiveSection(null)} className="text-brand-300 text-sm font-semibold">Back</button>
              <h2 className="text-lg font-bold text-white">{sections[activeSection].title}</h2>
              <button onClick={onClose} className="text-white/50 text-2xl press-scale"><IoClose /></button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white">Settings</h2>
              <button onClick={onClose} className="text-white/50 text-2xl press-scale"><IoClose /></button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
          {activeSection ? (
            sections[activeSection].content
          ) : (
            <>
              {/* Profile Card */}
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl">
                <img src={user?.photoURL || 'https://via.placeholder.com/60'} alt="" className="w-14 h-14 rounded-full object-cover shadow-md" />
                <div>
                  <div className="text-lg font-bold text-white">{user?.displayName || 'User'}</div>
                  <div className="text-sm text-white/50">{user?.email}</div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="flex flex-col gap-1">
                {Object.entries(sections).map(([key, section]) => {
                  const Icon = section.icon
                  return (
                    <button key={key} onClick={() => setActiveSection(key)} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <Icon className="text-xl text-white/70" />
                      <span className="flex-1 text-left text-white">{section.title}</span>
                      <IoChevronForward className="text-white/30" />
                    </button>
                  )
                })}
              </div>

              {/* Logout */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <button 
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 press-scale transition-colors"
                >
                  <IoLogOutOutline className="text-xl" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
