/**
 * Utility for parsing and fetching synced (LRC) & plain lyrics.
 */

// In-memory cache for fetched lyrics during session
const lyricsMemoryCache = new Map()

/**
 * Parses an LRC or plain text lyrics string into a structured format.
 * Accurately computes start and end times for each line, handles interludes (empty timestamps),
 * and filters out metadata tags.
 * 
 * @param {string} raw - Raw lyrics string (LRC format, <br> separated, or newline separated)
 * @returns {{ lines: Array<{ time: number|null, endTime: number|null, text: string, isInterlude: boolean }>, isSynced: boolean }}
 */
export function parseLyrics(raw) {
  if (!raw || typeof raw !== 'string') {
    return { lines: [], isSynced: false }
  }

  // Normalize: if contains <br>, replace with newlines
  const normalized = raw.replace(/<br\s*\/?>/gi, '\n')
  const rawLines = normalized.split(/\r?\n/)

  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
  const parsedItems = []
  let hasValidTimestamps = false

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Ignore metadata tags like [ar:Artist], [ti:Title], [al:Album], [length:...], [by:...]
    if (/^\[(ar|ti|al|by|offset|length|re|ve):.*\]$/i.test(trimmed)) {
      continue
    }

    const matches = [...trimmed.matchAll(timeRegex)]

    if (matches.length > 0) {
      hasValidTimestamps = true
      // Extract the lyric text by stripping all timestamps
      const text = trimmed.replace(timeRegex, '').trim()

      for (const match of matches) {
        const mins = parseInt(match[1], 10)
        const secs = parseInt(match[2], 10)
        const msStr = match[3] || '0'
        const ms = msStr.length === 3 ? parseInt(msStr, 10) / 1000 : parseInt(msStr, 10) / 100
        const timeInSeconds = mins * 60 + secs + ms

        parsedItems.push({
          time: Math.round(timeInSeconds * 100) / 100,
          text: text,
          isInterlude: !text
        })
      }
    } else {
      parsedItems.push({
        time: null,
        endTime: null,
        text: trimmed,
        isInterlude: false
      })
    }
  }

  if (hasValidTimestamps) {
    // Sort lines by timestamp
    parsedItems.sort((a, b) => {
      if (a.time === null) return 1
      if (b.time === null) return -1
      return a.time - b.time
    })

    // Compute start and end times for each line, and collapse consecutive empty interludes
    const cleanedLines = []
    for (let i = 0; i < parsedItems.length; i++) {
      const item = parsedItems[i]
      const nextItem = parsedItems[i + 1]

      const startTime = item.time
      let endTime = nextItem ? nextItem.time : startTime + 6

      // If this is an interlude (empty text timestamp)
      if (item.isInterlude) {
        // If there's a next item and the gap is at least 2.5 seconds, display interlude dots '•••'
        if (nextItem && (nextItem.time - startTime >= 2.5)) {
          cleanedLines.push({
            time: startTime,
            endTime: nextItem.time,
            text: '•••',
            isInterlude: true
          })
        }
        continue
      }

      // If the gap to next line is very long (> 7 seconds), cap the vocal line's endTime
      // so it doesn't stay highlighted during a long guitar or drum solo
      const naturalDuration = Math.max(2.5, Math.min(6.5, item.text.length * 0.12 + 1.2))
      if (nextItem && (nextItem.time - startTime > 7)) {
        endTime = startTime + naturalDuration
      }

      cleanedLines.push({
        time: startTime,
        endTime: endTime,
        text: item.text,
        isInterlude: false
      })
    }

    return { lines: cleanedLines, isSynced: true }
  }

  return { lines: parsedItems.filter(p => p.text), isSynced: false }
}

/**
 * Clean artist/title for cleaner API lookup
 */
function cleanQueryTerm(term) {
  if (!term) return ''
  return term
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s*\[.*?\]\s*/g, ' ')
    .replace(/feat\..*$/i, '')
    .replace(/ft\..*$/i, '')
    .trim()
}

/**
 * Fetches lyrics on the fly from LRCLIB if currentTrack doesn't have synced lyrics yet.
 * @param {string} title 
 * @param {string} artist 
 * @param {string|number} trackId 
 * @returns {Promise<{ lyrics: string, isSynced: boolean } | null>}
 */
export async function fetchLyricsOnTheFly(title, artist, trackId) {
  if (!title || !artist) return null

  const cacheKey = `lyrics_${trackId || `${artist}_${title}`.toLowerCase()}`
  
  // 1. Check in-memory cache
  if (lyricsMemoryCache.has(cacheKey)) {
    return lyricsMemoryCache.get(cacheKey)
  }

  // 2. Check localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      lyricsMemoryCache.set(cacheKey, parsed)
      return parsed
    }
  } catch {}

  // 3. Fetch from LRCLIB
  try {
    const cleanTitle = cleanQueryTerm(title)
    const cleanArtist = cleanQueryTerm(artist)

    const params = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: cleanArtist
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { 'User-Agent': 'ShadowMusicApp/2.0' },
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!res.ok) return null

    const data = await res.json()
    const resultLyrics = data.syncedLyrics || data.plainLyrics || null

    if (resultLyrics) {
      const payload = {
        lyrics: resultLyrics,
        isSynced: Boolean(data.syncedLyrics)
      }
      lyricsMemoryCache.set(cacheKey, payload)
      try {
        localStorage.setItem(cacheKey, JSON.stringify(payload))
      } catch {}
      return payload
    }
  } catch (err) {
    // Network or timeout failure; silently return null so default lyrics are used
  }

  return null
}
