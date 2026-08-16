import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { useToast } from './ToastContext'

const DownloadContext = createContext()

export function useDownload() {
  return useContext(DownloadContext)
}

export function DownloadProvider({ children }) {
  const { showToast } = useToast()
  const [downloadedSongs, setDownloadedSongs] = useState({})
  const [isDownloading, setIsDownloading] = useState({})
  const [playlistDownloadProgress, setPlaylistDownloadProgress] = useState({}) // { playlistId: { done, total } }
  const [isReady, setIsReady] = useState(false)

  // Load saved downloads on mount
  useEffect(() => {
    const loadDownloads = async () => {
      try {
        const { value } = await Preferences.get({ key: 'downloadedSongs' })
        if (value) {
          setDownloadedSongs(JSON.parse(value))
        }
      } catch (e) {
        console.error('Failed to load downloads:', e)
      } finally {
        setIsReady(true)
      }
    }
    loadDownloads()
  }, [])

  // Save to preferences whenever it changes
  useEffect(() => {
    Preferences.set({
      key: 'downloadedSongs',
      value: JSON.stringify(downloadedSongs)
    })
  }, [downloadedSongs])

  const getFilePath = (trackId) => `shadow_music_${trackId}.mp3`

  const downloadSong = useCallback(async (track) => {
    if (downloadedSongs[track.id]) return // Already downloaded

    setIsDownloading(prev => ({ ...prev, [track.id]: true }))
    
    try {
      const fileName = getFilePath(track.id)
      
      // Use native download to avoid loading entire file into JS memory
      await Filesystem.downloadFile({
        url: track.audioUrl,
        path: fileName,
        directory: Directory.Data
      })
      
      // Get URI
      const uriResult = await Filesystem.getUri({
        directory: Directory.Data,
        path: fileName
      })

      setDownloadedSongs(prev => ({
        ...prev,
        [track.id]: { localUri: uriResult.uri }
      }))
      
      showToast("Song downloaded for offline listening")
      setIsDownloading(prev => ({ ...prev, [track.id]: false }))
    } catch (e) {
      console.error('Download failed:', e)
      showToast("Failed to download song")
      setIsDownloading(prev => ({ ...prev, [track.id]: false }))
    }
  }, [downloadedSongs, showToast])

  const downloadPlaylist = useCallback(async (playlistId, songs) => {
    if (!songs || songs.length === 0) return

    // Filter out already downloaded songs
    const toDownload = songs.filter(s => !downloadedSongs[s.id])
    if (toDownload.length === 0) {
      showToast('All songs already downloaded!')
      return
    }

    setPlaylistDownloadProgress(prev => ({ ...prev, [playlistId]: { done: 0, total: toDownload.length } }))

    let done = 0
    for (const track of toDownload) {
      try {
        const fileName = getFilePath(track.id)
        await Filesystem.downloadFile({
          url: track.audioUrl,
          path: fileName,
          directory: Directory.Data
        })
        const uriResult = await Filesystem.getUri({
          directory: Directory.Data,
          path: fileName
        })
        setDownloadedSongs(prev => ({
          ...prev,
          [track.id]: { localUri: uriResult.uri }
        }))
      } catch (e) {
        console.error(`Failed to download ${track.title}:`, e)
      }
      done++
      setPlaylistDownloadProgress(prev => ({ ...prev, [playlistId]: { done, total: toDownload.length } }))
    }

    setPlaylistDownloadProgress(prev => {
      const next = { ...prev }
      delete next[playlistId]
      return next
    })
    showToast(`Playlist downloaded — ${done} songs ready offline`)
  }, [downloadedSongs, showToast])

  const removeDownload = useCallback(async (trackId) => {
    if (!downloadedSongs[trackId]) return

    try {
      await Filesystem.deleteFile({
        path: getFilePath(trackId),
        directory: Directory.Data
      })
      
      setDownloadedSongs(prev => {
        const next = { ...prev }
        delete next[trackId]
        return next
      })
      
      showToast("Download removed")
    } catch (e) {
      console.error('Failed to remove download:', e)
    }
  }, [downloadedSongs, showToast])

  const value = {
    downloadedSongs,
    isDownloading,
    playlistDownloadProgress,
    isReady,
    downloadSong,
    downloadPlaylist,
    removeDownload
  }

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  )
}
