/**
 * Utility for parsing and fetching synced (LRC) & plain lyrics.
 */

// In-memory cache for fetched lyrics during session
const lyricsMemoryCache = new Map()

/**
 * Parses an LRC or plain text lyrics string into a structured format.
 * @param {string} raw - Raw lyrics string (LRC format, <br> separated, or newline separated)
 * @returns {{ lines: Array<{ time: number|null, text: string }>, isSynced: boolean }}
 */
export function parseLyrics(raw) {
  if (!raw || typeof raw !== 'string') {
    return { lines: [], isSynced: false }
  }

  // Normalize: if contains <br>, replace with newlines
  const normalized = raw.replace(/<br\s*\/?>/gi, '\n')
  const rawLines = normalized.split(/\r?\n/)

  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
  const parsedLines = []
  let hasValidTimestamps = false

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Extract all timestamps on this line (some LRC lines have multiple: [00:12.00][00:14.00] text)
    const matches = [...trimmed.matchAll(timeRegex)]

    if (matches.length > 0) {
      hasValidTimestamps = true
      // Extract the lyric text by stripping timestamps
      const text = trimmed.replace(timeRegex, '').trim()

      for (const match of matches) {
        const mins = parseInt(match[1], 10)
        const secs = parseInt(match[2], 10)
        const msStr = match[3] || '0'
        const ms = msStr.length === 3 ? parseInt(msStr, 10) / 1000 : parseInt(msStr, 10) / 100
        const timeInSeconds = mins * 60 + secs + ms

        // Filter out LRC header tags like [length: 03:45], [ar: Artist], etc.
        if (text || trimmed === '') {
          parsedLines.push({
            time: Math.round(timeInSeconds * 100) / 100,
            text: text || '♪'
          })
        }
      }
    } else {
      // Plain line without timestamp
      parsedLines.push({
        time: null,
        text: trimmed
      })
    }
  }

  if (hasValidTimestamps) {
    // Sort lines by time
    parsedLines.sort((a, b) => {
      if (a.time === null) return 1
      if (b.time === null) return -1
      return a.time - b.time
    })
    return { lines: parsedLines, isSynced: true }
  }

  return { lines: parsedLines, isSynced: false }
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
