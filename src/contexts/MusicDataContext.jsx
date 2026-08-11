import React, { createContext, useContext, useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { Preferences } from '@capacitor/preferences'

const MusicDataContext = createContext()

export function useMusicData() {
  return useContext(MusicDataContext)
}

export function MusicDataProvider({ children }) {
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMusicData = async () => {
      try {
        const cachedSongsStr = await Preferences.get({ key: 'cached_songs' })
        const cachedArtistsStr = await Preferences.get({ key: 'cached_artists' })
        const lastFetchedStr = await Preferences.get({ key: 'music_data_last_fetched' })
        
        let shouldUseCache = false
        if (cachedSongsStr.value && cachedArtistsStr.value && lastFetchedStr.value) {
          const lastFetched = parseInt(lastFetchedStr.value)
          const now = Date.now()
          // Use cache if less than 1 hour old (3600000 ms)
          if (now - lastFetched < 3600000) {
            shouldUseCache = true
          }
        }

        if (shouldUseCache) {
          setSongs(JSON.parse(cachedSongsStr.value))
          setArtists(JSON.parse(cachedArtistsStr.value))
          setLoading(false)
          return
        }

        // Fetch from Firestore
        const songsQuery = query(collection(db, 'songs'), orderBy('createdAt', 'desc'), limit(200))
        const songsSnapshot = await getDocs(songsQuery)
        const fetchedSongs = songsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        const artistsSnapshot = await getDocs(collection(db, 'artists'))
        const fetchedArtists = {}
        artistsSnapshot.docs.forEach(doc => {
          fetchedArtists[doc.id] = { id: doc.id, ...doc.data() }
        })

        setSongs(fetchedSongs)
        setArtists(fetchedArtists)
        setLoading(false)

        // Cache the data
        await Preferences.set({ key: 'cached_songs', value: JSON.stringify(fetchedSongs) })
        await Preferences.set({ key: 'cached_artists', value: JSON.stringify(fetchedArtists) })
        await Preferences.set({ key: 'music_data_last_fetched', value: Date.now().toString() })
      } catch (error) {
        console.error("Error fetching music data:", error)
        // Fallback to cache even if stale, if available
        const cachedSongsStr = await Preferences.get({ key: 'cached_songs' })
        const cachedArtistsStr = await Preferences.get({ key: 'cached_artists' })
        if (cachedSongsStr.value && cachedArtistsStr.value) {
          setSongs(JSON.parse(cachedSongsStr.value))
          setArtists(JSON.parse(cachedArtistsStr.value))
        }
        setLoading(false)
      }
    }

    fetchMusicData()
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
