import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

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

  // Load user data from Firestore on login
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

    const loadData = async () => {
      try {
        // Load main user doc
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const data = userSnap.data()
          setLikedSongIds(data.likedSongIds || [])
          setFollowedArtists(data.followedArtists || [])
          setHasOnboarded(data.hasOnboarded || false)
        } else {
          // Create the user doc if it doesn't exist
          await setDoc(userRef, { likedSongIds: [], followedArtists: [], hasOnboarded: false })
          setHasOnboarded(false)
        }

        // Load playlists
        const playlistsRef = collection(db, 'users', user.uid, 'playlists')
        const playlistSnap = await getDocs(playlistsRef)
        const loadedPlaylists = playlistSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setPlaylists(loadedPlaylists)

        // Load recent searches from localStorage
        const saved = localStorage.getItem(`recentSearches_${user.uid}`)
        if (saved) setRecentSearches(JSON.parse(saved))

        setDataLoaded(true)
      } catch (error) {
        console.error('Error loading user data:', error)
        setDataLoaded(true)
      }
    }

    loadData()
  }, [user])

  // ── Liked Songs ──
  const toggleLikeSong = useCallback(async (songId) => {
    if (!user) return
    const isLiked = likedSongIds.includes(songId)
    const updated = isLiked
      ? likedSongIds.filter(id => id !== songId)
      : [...likedSongIds, songId]
    setLikedSongIds(updated)
    try {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      await setDoc(doc(db, 'users', user.uid), { likedSongIds: updated }, { merge: true })
      showToast(isLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs')
    } catch (e) { console.error('Error toggling like:', e) }
  }, [user, likedSongIds, showToast])

  const isSongLiked = useCallback((songId) => {
    return likedSongIds.includes(songId)
  }, [likedSongIds])

  const completeOnboarding = useCallback(async () => {
    if (!user) return
    setHasOnboarded(true)
    try {
      await setDoc(doc(db, 'users', user.uid), { hasOnboarded: true }, { merge: true })
    } catch (e) { console.error('Error setting onboarded state:', e) }
  }, [user])

  // ── Followed Artists ──
  const toggleFollowArtist = useCallback(async (artistName) => {
    if (!user) return
    const isFollowed = followedArtists.includes(artistName)
    const updated = isFollowed
      ? followedArtists.filter(n => n !== artistName)
      : [...followedArtists, artistName]
    setFollowedArtists(updated)
    try {
      await setDoc(doc(db, 'users', user.uid), { followedArtists: updated }, { merge: true })
    } catch (e) { console.error('Error toggling follow:', e) }
  }, [user, followedArtists])

  const isArtistFollowed = useCallback((artistName) => {
    return followedArtists.includes(artistName)
  }, [followedArtists])

  // ── Playlists ──
  const createPlaylist = useCallback(async (name) => {
    if (!user || !name.trim()) return null
    try {
      const playlistData = { name: name.trim(), songIds: [], createdAt: Date.now() }
      const playlistsRef = collection(db, 'users', user.uid, 'playlists')
      const docRef = await addDoc(playlistsRef, playlistData)
      const newPlaylist = { id: docRef.id, ...playlistData }
      setPlaylists(prev => [...prev, newPlaylist])
      showToast(`Playlist "${name}" created`)
      return newPlaylist
    } catch (e) { console.error('Error creating playlist:', e); return null }
  }, [user, showToast])

  const deletePlaylist = useCallback(async (playlistId) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'playlists', playlistId))
      setPlaylists(prev => prev.filter(p => p.id !== playlistId))
    } catch (e) { console.error('Error deleting playlist:', e) }
  }, [user])

  const addSongToPlaylist = useCallback(async (playlistId, songId) => {
    if (!user) return
    const playlist = playlists.find(p => p.id === playlistId)
    if (!playlist || playlist.songIds.includes(songId)) return
    const updated = [...playlist.songIds, songId]
    try {
      await updateDoc(doc(db, 'users', user.uid, 'playlists', playlistId), { songIds: updated })
      setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, songIds: updated } : p))
      showToast(`Added to ${playlist.name}`)
    } catch (e) { console.error('Error adding to playlist:', e) }
  }, [user, playlists, showToast])

  const removeSongFromPlaylist = useCallback(async (playlistId, trackId) => {
    if (!user) return
    const playlist = playlists.find(p => p.id === playlistId)
    if (!playlist) return
    const updated = playlist.songIds.filter(id => id !== trackId)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'playlists', playlistId), { songIds: updated })
      setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, songIds: updated } : p))
      showToast("Song removed")
    } catch (e) { console.error('Error removing from playlist:', e) }
  }, [user, playlists, showToast])

  const reorderPlaylist = useCallback(async (playlistId, startIndex, endIndex) => {
    if (!user) return
    const playlist = playlists.find(p => p.id === playlistId)
    if (!playlist) return
    const newSongIds = [...playlist.songIds]
    const [removed] = newSongIds.splice(startIndex, 1)
    newSongIds.splice(endIndex, 0, removed)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'playlists', playlistId), { songIds: newSongIds })
      setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, songIds: newSongIds } : p))
    } catch (e) { console.error('Error reordering playlist:', e) }
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
      
      await updateDoc(doc(db, 'users', user.uid, 'playlists', playlistId), { coverUrl: imageUrl })
      setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, coverUrl: imageUrl } : p))
      showToast("Cover updated")
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
