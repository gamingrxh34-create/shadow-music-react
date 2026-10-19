import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'

const UserDataContext = createContext()

export function useUserData() {
  return useContext(UserDataContext)
}

export function UserDataProvider({ children }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [likedSongIds, setLikedSongIds] = useState([])
  const [followedArtists, setFollowedArtists] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [recentSearches, setRecentSearches] = useState([])
  const [hasOnboarded, setHasOnboarded] = useState(false)
  const [recentHistory, setRecentHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('recentHistory')) || []
    } catch {
      return []
    }
  })
  const [dataLoaded, setDataLoaded] = useState(false)

  // Load user data: local Preferences first (instant, offline-safe), then sync with Firestore
  useEffect(() => {
    if (!user) {
      setLikedSongIds([])
      setFollowedArtists([])
      setPlaylists([])
      setRecentSearches([])
      setHasOnboarded(false)
      setDataLoaded(false)
      return
    }

    const localOnboarded = localStorage.getItem(`has_completed_onboarding_${user.uid}`) === 'true'
    if (localOnboarded) {
      setHasOnboarded(true)
    }

    const loadData = async () => {
      // 1. Immediately load cached data from native storage (Preferences) so user NEVER sees empty state
      let localLikes = []
      let localFollows = []
      let localPlaylists = []

      try {
        const [likesRes, followsRes, playlistsRes] = await Promise.all([
          Preferences.get({ key: `user_likes_${user.uid}` }),
          Preferences.get({ key: `user_follows_${user.uid}` }),
          Preferences.get({ key: `user_playlists_${user.uid}` })
        ])

        if (likesRes.value) {
          localLikes = JSON.parse(likesRes.value) || []
          setLikedSongIds(localLikes)
        }
        if (followsRes.value) {
          localFollows = JSON.parse(followsRes.value) || []
          setFollowedArtists(localFollows)
        }
        if (playlistsRes.value) {
          localPlaylists = JSON.parse(playlistsRes.value) || []
          setPlaylists(localPlaylists)
        }
      } catch (err) {
        console.warn('Error reading local user cache:', err)
      }

      // Mark data loaded early so UI shows immediately with local data
      setDataLoaded(true)

      // 2. Fetch latest from Firestore in background and merge with local data
      try {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const data = userSnap.data()
          const cloudLikes = data.likedSongIds || []
          const cloudFollows = data.followedArtists || []

          // Union of cloud & local so offline additions are never overwritten
          const mergedLikes = Array.from(new Set([...localLikes, ...cloudLikes]))
          const mergedFollows = Array.from(new Set([...localFollows, ...cloudFollows]))

          setLikedSongIds(mergedLikes)
          setFollowedArtists(mergedFollows)
          await Preferences.set({ key: `user_likes_${user.uid}`, value: JSON.stringify(mergedLikes) })
          await Preferences.set({ key: `user_follows_${user.uid}`, value: JSON.stringify(mergedFollows) })

          const onboardedState = data.hasOnboarded || localOnboarded || false
          setHasOnboarded(onboardedState)
          if (onboardedState) {
            localStorage.setItem(`has_completed_onboarding_${user.uid}`, 'true')
          }

          // If local had extra items, sync back to Firestore
          if (mergedLikes.length !== cloudLikes.length || mergedFollows.length !== cloudFollows.length) {
            setDoc(userRef, { likedSongIds: mergedLikes, followedArtists: mergedFollows }, { merge: true }).catch(() => {})
          }
        } else {
          // New user document in Firestore - preserve whatever was locally liked/followed
          await setDoc(userRef, { 
            likedSongIds: localLikes, 
            followedArtists: localFollows, 
            hasOnboarded: localOnboarded || false,
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || ''
          }, { merge: true })
          setHasOnboarded(localOnboarded || false)
        }

        // Fetch Playlists from Firestore and merge with local playlists
        const playlistsRef = collection(db, 'users', user.uid, 'playlists')
        const playlistSnap = await getDocs(playlistsRef)
        const cloudPlaylists = playlistSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        const cloudIds = new Set(cloudPlaylists.map(p => p.id))
        const localOnly = localPlaylists.filter(p => !cloudIds.has(p.id))
        const mergedPlaylists = [...cloudPlaylists, ...localOnly]

        setPlaylists(mergedPlaylists)
        await Preferences.set({ key: `user_playlists_${user.uid}`, value: JSON.stringify(mergedPlaylists) })

        // Upload any local-only playlists to cloud in background
        for (const p of localOnly) {
          setDoc(doc(db, 'users', user.uid, 'playlists', p.id), p).catch(() => {})
        }

        // Load recent searches from localStorage
        const saved = localStorage.getItem(`recentSearches_${user.uid}`)
        if (saved) setRecentSearches(JSON.parse(saved))
      } catch (error) {
        console.warn('Firestore cloud sync deferred (offline/rules), running with local data:', error)
      }
    }

    loadData()
  }, [user])

  // ── Liked Songs (Immediate local save + background Firestore sync) ──
  const toggleLikeSong = useCallback(async (songId) => {
    if (!user) return
    const isLiked = likedSongIds.includes(songId)
    const updated = isLiked
      ? likedSongIds.filter(id => id !== songId)
      : [...likedSongIds, songId]

    // 1. Update React state immediately
    setLikedSongIds(updated)
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    showToast(isLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs')

    // 2. Persist to native storage immediately so it NEVER gets removed on restart
    await Preferences.set({ key: `user_likes_${user.uid}`, value: JSON.stringify(updated) })

    // 3. Sync to Firestore in background
    try {
      await setDoc(doc(db, 'users', user.uid), { likedSongIds: updated }, { merge: true })
    } catch (e) {
      console.warn('Firestore like sync failed, safely saved locally:', e)
    }
  }, [user, likedSongIds, showToast])

  const isSongLiked = useCallback((songId) => {
    return likedSongIds.includes(songId)
  }, [likedSongIds])

  const completeOnboarding = useCallback(async () => {
    if (!user) return
    setHasOnboarded(true)
    localStorage.setItem(`has_completed_onboarding_${user.uid}`, 'true')
    try {
      await setDoc(doc(db, 'users', user.uid), { hasOnboarded: true }, { merge: true })
    } catch (e) { console.warn('Error setting onboarded state:', e) }
  }, [user])

  // ── Followed Artists ──
  const toggleFollowArtist = useCallback(async (artistName) => {
    if (!user) return
    const isFollowed = followedArtists.includes(artistName)
    const updated = isFollowed
      ? followedArtists.filter(n => n !== artistName)
      : [...followedArtists, artistName]

    setFollowedArtists(updated)
    await Preferences.set({ key: `user_follows_${user.uid}`, value: JSON.stringify(updated) })

    try {
      await setDoc(doc(db, 'users', user.uid), { followedArtists: updated }, { merge: true })
    } catch (e) { console.warn('Error toggling follow:', e) }
  }, [user, followedArtists])

  const isArtistFollowed = useCallback((artistName) => {
    return followedArtists.includes(artistName)
  }, [followedArtists])

  // ── Playlists (Optimistic local creation + background Firestore sync) ──
  const createPlaylist = useCallback(async (name) => {
    if (!user || !name.trim()) return null
    const playlistId = 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
    const playlistData = { 
      id: playlistId, 
      name: name.trim(), 
      songIds: [], 
      createdAt: Date.now() 
    }

    // 1. Immediately add to playlists state and save locally
    setPlaylists(prev => {
      const updated = [...prev, playlistData]
      Preferences.set({ key: `user_playlists_${user.uid}`, value: JSON.stringify(updated) }).catch(() => {})
      return updated
    })

    showToast(`Playlist "${name.trim()}" created`)

    // 2. Sync to Firestore in background
    try {
      await setDoc(doc(db, 'users', user.uid, 'playlists', playlistId), playlistData)
    } catch (e) {
      console.warn('Firestore playlist creation deferred, saved locally:', e)
    }

    return playlistData
  }, [user, showToast])

  const deletePlaylist = useCallback(async (playlistId) => {
    if (!user) return
    setPlaylists(prev => {
      const updated = prev.filter(p => p.id !== playlistId)
      Preferences.set({ key: `user_playlists_${user.uid}`, value: JSON.stringify(updated) }).catch(() => {})
      return updated
    })
    showToast('Playlist deleted')
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'playlists', playlistId))
    } catch (e) { console.warn('Error deleting playlist:', e) }
  }, [user, showToast])

  const addSongToPlaylist = useCallback(async (playlistId, songId) => {
    if (!user) return
    let playlistName = ''
    setPlaylists(prev => {
      const target = prev.find(p => p.id === playlistId)
      if (!target) return prev
      playlistName = target.name
      if (target.songIds.includes(songId)) return prev
      const updated = prev.map(p => p.id === playlistId ? { ...p, songIds: [...p.songIds, songId] } : p)
      Preferences.set({ key: `user_playlists_${user.uid}`, value: JSON.stringify(updated) }).catch(() => {})
      return updated
    })

    if (playlistName) {
      showToast(`Added to ${playlistName}`)
    }

    try {
      const target = playlists.find(p => p.id === playlistId)
      const currentIds = target?.songIds || []
      const updatedIds = currentIds.includes(songId) ? currentIds : [...currentIds, songId]
      await setDoc(doc(db, 'users', user.uid, 'playlists', playlistId), { songIds: updatedIds }, { merge: true })
    } catch (e) { console.warn('Error adding to playlist:', e) }
  }, [user, playlists, showToast])

  const removeSongFromPlaylist = useCallback(async (playlistId, trackId) => {
    if (!user) return
    setPlaylists(prev => {
      const updated = prev.map(p => p.id === playlistId ? { ...p, songIds: p.songIds.filter(id => id !== trackId) } : p)
      Preferences.set({ key: `user_playlists_${user.uid}`, value: JSON.stringify(updated) }).catch(() => {})
      return updated
    })
    showToast("Song removed")
    try {
      const target = playlists.find(p => p.id === playlistId)
      const updatedIds = target ? target.songIds.filter(id => id !== trackId) : []
      await setDoc(doc(db, 'users', user.uid, 'playlists', playlistId), { songIds: updatedIds }, { merge: true })
    } catch (e) { console.warn('Error removing from playlist:', e) }
  }, [user, playlists, showToast])

  const reorderPlaylist = useCallback(async (playlistId, startIndex, endIndex) => {
    if (!user) return
    const playlist = playlists.find(p => p.id === playlistId)
    if (!playlist) return
    const newSongIds = [...playlist.songIds]
    const [removed] = newSongIds.splice(startIndex, 1)
    newSongIds.splice(endIndex, 0, removed)

    setPlaylists(prev => {
      const updated = prev.map(p => p.id === playlistId ? { ...p, songIds: newSongIds } : p)
      Preferences.set({ key: `user_playlists_${user.uid}`, value: JSON.stringify(updated) }).catch(() => {})
      return updated
    })

    try {
      await setDoc(doc(db, 'users', user.uid, 'playlists', playlistId), { songIds: newSongIds }, { merge: true })
    } catch (e) { console.warn('Error reordering playlist:', e) }
  }, [user, playlists])

  const updatePlaylistCover = useCallback(async (playlistId, file) => {
    if (!user || !file) return
    try {
      showToast("Uploading cover...")
      
      // Resize/compress image using canvas
      const resizedBlob = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_SIZE = 300
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width
              width = MAX_SIZE
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height
              height = MAX_SIZE
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob(resolve, 'image/jpeg', 0.8)
        }
        img.onerror = reject
        img.src = URL.createObjectURL(file)
      })

      const storageRef = ref(storage, `users/${user.uid}/playlists/${playlistId}/cover_${Date.now()}`)
      await uploadBytes(storageRef, resizedBlob)
      const imageUrl = await getDownloadURL(storageRef)
      
      setPlaylists(prev => {
        const updated = prev.map(p => p.id === playlistId ? { ...p, coverUrl: imageUrl } : p)
        Preferences.set({ key: `user_playlists_${user.uid}`, value: JSON.stringify(updated) }).catch(() => {})
        return updated
      })
      showToast("Cover updated")

      try {
        await setDoc(doc(db, 'users', user.uid, 'playlists', playlistId), { coverUrl: imageUrl }, { merge: true })
      } catch (err) {
        console.warn('Firestore cover sync deferred:', err)
      }
    } catch (e) { 
      console.error('Error updating playlist cover:', e) 
      showToast("Error updating cover")
    }
  }, [user, showToast])

  // ── Recent Searches ──
  const addRecentSearch = useCallback((query) => {
    if (!user || !query.trim()) return
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== query.toLowerCase())
      const updated = [query.trim(), ...filtered].slice(0, 10)
      localStorage.setItem(`recentSearches_${user.uid}`, JSON.stringify(updated))
      return updated
    })
  }, [user])

  const removeRecentSearch = useCallback((query) => {
    if (!user) return
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== query)
      localStorage.setItem(`recentSearches_${user.uid}`, JSON.stringify(updated))
      return updated
    })
  }, [user])

  const clearRecentSearches = useCallback(() => {
    if (!user) return
    setRecentSearches([])
    localStorage.removeItem(`recentSearches_${user.uid}`)
  }, [user])

  // ── Recent History ──
  const addToHistory = useCallback((track) => {
    setRecentHistory(prev => {
      const filtered = prev.filter(t => t.id !== track.id)
      const updated = [track, ...filtered].slice(0, 20)
      localStorage.setItem('recentHistory', JSON.stringify(updated))
      return updated
    })
  }, [])

  const removeFromHistory = useCallback((trackId) => {
    setRecentHistory(prev => {
      const updated = prev.filter(t => t.id !== trackId)
      localStorage.setItem('recentHistory', JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearHistory = useCallback(() => {
    setRecentHistory([])
    localStorage.removeItem('recentHistory')
  }, [])

  const value = {
    likedSongIds, followedArtists, playlists, recentSearches, recentHistory, dataLoaded, hasOnboarded,
    toggleLikeSong, isSongLiked,
    toggleFollowArtist, isArtistFollowed, completeOnboarding,
    createPlaylist, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist, reorderPlaylist, updatePlaylistCover,
    addRecentSearch, removeRecentSearch, clearRecentSearches,
    addToHistory, removeFromHistory, clearHistory
  }

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  )
}
