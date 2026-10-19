import React, { createContext, useContext, useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
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
          const cachedSongs = JSON.parse(cachedSongsStr.value) || []
          const cachedArtists = JSON.parse(cachedArtistsStr.value) || {}
          
          // Ensure default artists (like Elvarn) and their tracks are always included
          const mergedArtists = { ...DEFAULT_ARTISTS, ...cachedArtists }
          const cachedSongIds = new Set(cachedSongs.map(s => s.id))
          const missingDefaults = DEFAULT_SONGS.filter(s => !cachedSongIds.has(s.id))
          
          setSongs([...cachedSongs, ...missingDefaults])
          setArtists(mergedArtists)
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

        // Always merge with default artists and tracks (guarantees Elvarn is present)
        const finalArtists = { ...DEFAULT_ARTISTS, ...fetchedArtists }
        const fetchedIds = new Set(fetchedSongs.map(s => s.id))
        const missingSongs = DEFAULT_SONGS.filter(s => !fetchedIds.has(s.id))
        const finalSongs = [...fetchedSongs, ...missingSongs]

        setSongs(finalSongs)
        setArtists(finalArtists)
        setLoading(false)

        // Cache the data
        await Preferences.set({ key: 'cached_songs', value: JSON.stringify(finalSongs) })
        await Preferences.set({ key: 'cached_artists', value: JSON.stringify(finalArtists) })
        await Preferences.set({ key: 'music_data_last_fetched', value: Date.now().toString() })
      } catch (error) {
        console.error("Error fetching music data:", error)
        // Fallback to cache or defaults
        const cachedSongsStr = await Preferences.get({ key: 'cached_songs' })
        const cachedArtistsStr = await Preferences.get({ key: 'cached_artists' })
        if (cachedSongsStr.value && cachedArtistsStr.value) {
          const cachedSongs = JSON.parse(cachedSongsStr.value) || []
          const cachedArtists = JSON.parse(cachedArtistsStr.value) || {}
          setSongs([...cachedSongs, ...DEFAULT_SONGS.filter(s => !cachedSongs.some(c => c.id === s.id))])
          setArtists({ ...DEFAULT_ARTISTS, ...cachedArtists })
        } else {
          setSongs(DEFAULT_SONGS)
          setArtists(DEFAULT_ARTISTS)
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
