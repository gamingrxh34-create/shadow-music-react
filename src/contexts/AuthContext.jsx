import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithRedirect, getRedirectResult, signInWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { auth, googleProvider } from '../firebase/config'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

function normalizeUser(rawUser) {
  if (!rawUser) return null
  return {
    uid: rawUser.uid,
    displayName: rawUser.displayName || 'Shadow User',
    email: rawUser.email || '',
    photoURL: rawUser.photoURL || rawUser.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(rawUser.displayName || 'User')}&background=38d1b0&color=fff`
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let nativeListener = null

    // 1. Immediately check local cached auth user for instant offline startup
    const checkCachedUser = async () => {
      try {
        const { value } = await Preferences.get({ key: 'cached_auth_user' })
        if (value) {
          const parsed = JSON.parse(value)
          if (parsed && parsed.uid) {
            setUser(parsed)
            setLoading(false)
          }
        }
      } catch (e) {
        try {
          const local = localStorage.getItem('cached_auth_user')
          if (local) {
            setUser(JSON.parse(local))
            setLoading(false)
          }
        } catch {}
      }
    }
    checkCachedUser()

    // 2. Native Android/iOS listener & current user check
    if (Capacitor.isNativePlatform()) {
      FirebaseAuthentication.getCurrentUser().then((res) => {
        if (res?.user) {
          const norm = normalizeUser(res.user)
          setUser(norm)
          setLoading(false)
          Preferences.set({ key: 'cached_auth_user', value: JSON.stringify(norm) }).catch(() => {})
        }
      }).catch((e) => console.warn('Native getCurrentUser error:', e))

      FirebaseAuthentication.addListener('authStateChange', ({ user: nativeUser }) => {
        if (nativeUser) {
          const norm = normalizeUser(nativeUser)
          setUser(norm)
          Preferences.set({ key: 'cached_auth_user', value: JSON.stringify(norm) }).catch(() => {})
        }
        setLoading(false)
      }).then(handle => { nativeListener = handle }).catch(() => {})
    } else {
      getRedirectResult(auth).catch((error) => {
        console.error('Redirect auth error:', error)
      })
    }

    // 3. JS Firebase Auth SDK listener
    const unsubscribe = onAuthStateChanged(auth, (jsUser) => {
      if (jsUser) {
        const norm = normalizeUser(jsUser)
        setUser(norm)
        Preferences.set({ key: 'cached_auth_user', value: JSON.stringify(norm) }).catch(() => {})
      }
      setLoading(false)
    })

    return () => {
      unsubscribe()
      if (nativeListener && typeof nativeListener.remove === 'function') {
        nativeListener.remove()
      }
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        let result = null

        // Try standard Google Sign-In intent first (compatible with all Android versions)
        try {
          result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false })
        } catch (firstErr) {
          console.warn('Standard Google Sign-In failed, trying Credential Manager:', firstErr)
          // Fall back to Credential Manager API if standard flow errored
          result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true })
        }

        // If native auth returned a user, immediately log in!
        const nativeUser = result?.user
        if (nativeUser) {
          const norm = normalizeUser(nativeUser)
          setUser(norm)
          setLoading(false)
          await Preferences.set({ key: 'cached_auth_user', value: JSON.stringify(norm) })
        }

        // Mirror token into JS SDK if available
        const idToken = result?.credential?.idToken
        if (idToken) {
          try {
            const credential = GoogleAuthProvider.credential(idToken)
            const jsCred = await signInWithCredential(auth, credential)
            if (jsCred?.user) {
              const norm = normalizeUser(jsCred.user)
              setUser(norm)
              await Preferences.set({ key: 'cached_auth_user', value: JSON.stringify(norm) })
            }
          } catch (mirrorErr) {
            console.warn('Mirroring token to JS SDK failed, but native session active:', mirrorErr)
          }
        }

        if (!nativeUser && !idToken) {
          throw new Error('Google Sign-In returned no user or credentials.')
        }
      } else {
        await signInWithRedirect(auth, googleProvider)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const continueAsGuest = async () => {
    const guestUser = {
      uid: 'guest_user_1',
      displayName: 'Guest User',
      email: 'guest@shadowmusic.app',
      photoURL: 'https://ui-avatars.com/api/?name=Guest+User&background=38d1b0&color=fff'
    }
    setUser(guestUser)
    setLoading(false)
    try {
      await Preferences.set({ key: 'cached_auth_user', value: JSON.stringify(guestUser) })
      localStorage.setItem('cached_auth_user', JSON.stringify(guestUser))
    } catch {}
  }

  const logout = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut().catch(() => {})
      }
      await signOut(auth).catch(() => {})
      await Preferences.remove({ key: 'cached_auth_user' }).catch(() => {})
      localStorage.removeItem('cached_auth_user')
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
      setUser(null)
    }
  }

  const value = { user, loading, signInWithGoogle, continueAsGuest, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
