import { useLocation, useNavigate } from 'react-router-dom'
import { IoHome, IoHomeOutline, IoSearch, IoSearchOutline, IoLibrary, IoLibraryOutline } from 'react-icons/io5'

const tabs = [
  { path: '/home', label: 'Home', activeIcon: IoHome, inactiveIcon: IoHomeOutline },
  { path: '/search', label: 'Search', activeIcon: IoSearch, inactiveIcon: IoSearchOutline },
  { path: '/library', label: 'Library', activeIcon: IoLibrary, inactiveIcon: IoLibraryOutline },
]

function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-white/[0.04]">
      <div className="flex items-center justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path
          const Icon = isActive ? tab.activeIcon : tab.inactiveIcon
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1 px-6 py-1 transition-all duration-200 press-scale ${
                isActive ? 'text-brand-300' : 'text-white/40'
              }`}
            >
              <Icon className={`transition-all duration-200 ${isActive ? 'text-2xl' : 'text-xl'}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-brand-300' : 'text-white/40'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
