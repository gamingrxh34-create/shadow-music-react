import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase/config'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Catch the result when returning from Google's redirect page
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect auth error:', error)
    })

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    try {
      await signInWithRedirect(auth, googleProvider)
    } catch (error) {
      console.error('Sign in error:', error)
    }
  const continueAsGuest = () => {
    setUser({
      uid: 'guest_user_1',
      displayName: 'Guest User',
      email: 'guest@shadowmusic.app',
      photoURL: 'https://ui-avatars.com/api/?name=Guest+User&background=38d1b0&color=fff'
    })
    setLoading(false)
  }

  const logout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const value = { user, loading, signInWithGoogle, continueAsGuest, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
