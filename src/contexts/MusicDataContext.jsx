import React, { createContext, useContext, useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, onSnapshot } from 'firebase/firestore'
import { Preferences } from '@capacitor/preferences'
import { DEFAULT_ARTISTS, DEFAULT_SONGS } from '../data/defaultData'

const MusicDataContext = createContext()

export function useMusicData() {
  return useContext(MusicDataContext)
}

export function MusicDataProvider({ children }) {
  const [songs, setSongs] = useState(DEFAULT_SONGS)
  const [artists, setArtists] = useState(DEFAULT_ARTISTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 1. Immediately load last cached data from Preferences for instant display
    const loadCached = async () => {
      try {
        const cachedSongsStr = await Preferences.get({ key: 'cached_songs' })
        const cachedArtistsStr = await Preferences.get({ key: 'cached_artists' })
        if (cachedSongsStr.value && cachedArtistsStr.value) {
          const parsedSongs = JSON.parse(cachedSongsStr.value)
          const parsedArtists = JSON.parse(cachedArtistsStr.value)
          if (parsedSongs?.length > 0) setSongs(parsedSongs)
          if (parsedArtists && Object.keys(parsedArtists).length > 0) setArtists(parsedArtists)
        }
      } catch (e) {
        console.warn('Failed to load local music cache:', e)
      }
    }
    loadCached()

    // 2. Real-time live listeners directly from Firebase Firestore:
    // If Firestore has documents, stream them live into the app!
    let unsubSongs = () => {}
    let unsubArtists = () => {}

    try {
      if (db) {
        // Listen to 'songs' collection from Firebase
        unsubSongs = onSnapshot(collection(db, 'songs'), (snapshot) => {
          if (!snapshot.empty) {
            const firestoreSongs = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            setSongs(firestoreSongs)
            setLoading(false)
            Preferences.set({ key: 'cached_songs', value: JSON.stringify(firestoreSongs) }).catch(() => {})
          } else {
            setLoading(false)
          }
        }, (error) => {
          console.warn('Firestore songs listener error (offline/rules):', error)
          setLoading(false)
        })

        // Listen to 'artists' collection from Firebase
        unsubArtists = onSnapshot(collection(db, 'artists'), (snapshot) => {
          if (!snapshot.empty) {
            const firestoreArtists = {}
            snapshot.docs.forEach(doc => {
              firestoreArtists[doc.id] = { id: doc.id, ...doc.data() }
            })
            setArtists(firestoreArtists)
            setLoading(false)
            Preferences.set({ key: 'cached_artists', value: JSON.stringify(firestoreArtists) }).catch(() => {})
          } else {
            setLoading(false)
          }
        }, (error) => {
          console.warn('Firestore artists listener error (offline/rules):', error)
          setLoading(false)
        })
      }
    } catch (e) {
      console.warn('Failed to setup Firestore listeners:', e)
      setLoading(false)
    }

    return () => {
      unsubSongs()
      unsubArtists()
    }
  }, [])

  const value = {
    songs,
    artists,
    loading
  }

  return (
    <MusicDataContext.Provider value={value}>
      {children}
    </MusicDataContext.Provider>
  )
}
