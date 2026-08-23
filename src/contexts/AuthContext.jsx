import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithRedirect, getRedirectResult, signInWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { Capacitor } from '@capacitor/core'
import { auth, googleProvider } from '../firebase/config'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Web fallback only — native platforms use the plugin's own sign-in flow below,
    // which never triggers a WebView redirect in the first place.
    if (!Capacitor.isNativePlatform()) {
      getRedirectResult(auth).catch((error) => {
        console.error('Redirect auth error:', error)
      })
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Native Google Sign-In (no WebView redirect, no storage-partitioning issue).
        // This opens the real native account picker and returns tokens directly.
        const result = await FirebaseAuthentication.signInWithGoogle()
        const idToken = result.credential?.idToken
        if (!idToken) throw new Error('No ID token returned from native Google sign-in')

        // Mirror the native session into the JS SDK so the rest of the app
        // (which reads `auth` from firebase/auth) sees the same signed-in user.
        const credential = GoogleAuthProvider.credential(idToken)
        await signInWithCredential(auth, credential)
      } else {
        await signInWithRedirect(auth, googleProvider)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      alert("Login Error: " + (error.message || error))
    }
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
      if (Capacitor.isNativePlatform()) {
        // Clears the native Google session too, otherwise the next sign-in
        // silently re-picks the same account instead of showing the chooser.
        await FirebaseAuthentication.signOut()
      }
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
