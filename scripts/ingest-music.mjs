import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as musicMetadata from 'music-metadata'
import dotenv from 'dotenv'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Firebase Web SDK Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBRcZ9DtwkFYBDuABbK2bzPwaArHlk0YRg",
  authDomain: "shadow-music-f2b43.firebaseapp.com",
  projectId: "shadow-music-f2b43",
  storageBucket: "shadow-music-f2b43.firebasestorage.app",
  messagingSenderId: "605927658698",
  appId: "1:605927658698:web:b499f6944beab9e3521033"
}

const firebaseApp = initializeApp(firebaseConfig)
const db = getFirestore(firebaseApp)

// Cloudflare R2 Client setup
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'shadow-music-audio'
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

const hasR2Config = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_PUBLIC_URL

let s3 = null
if (hasR2Config) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  })
}

// Helper: Clean raw YouTube / web filenames
function cleanFilename(rawName) {
  let name = rawName
    .replace(/\.(mp3|m4a|wav|flac)$/i, '')
    .replace(/\[(Official Video|Official Audio|Lyric Video|Audio|HQ|4K|1080p|Visualizer|Lyrics)\]/gi, '')
    .replace(/\((Official Video|Official Audio|Lyric Video|Audio|HQ|4K|1080p|Visualizer|Lyrics)\)/gi, '')
    .replace(/_/g, ' ')
    .trim()

  let artist = ''
  let title = name

  if (name.includes(' - ')) {
    const parts = name.split(' - ')
    artist = parts[0].trim()
    title = parts.slice(1).join(' - ').trim()
  }

  return { artist, title }
}

// Helper: Fetch official metadata & artwork from Apple Music/iTunes API
async function fetchOfficialMetadata(title, artist) {
  try {
    const query = encodeURIComponent(`${artist} ${title}`)
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.results || data.results.length === 0) return null

    const match = data.results[0]
    let coverArt = match.artworkUrl100
    if (coverArt) {
      // Scale up to crisp 600x600 resolution
      coverArt = coverArt.replace('100x100bb.jpg', '600x600bb.jpg')
    }

    return {
      title: match.trackName || title,
      artist: match.artistName || artist,
      album: match.collectionName || 'Single',
      genre: match.primaryGenreName || 'Music',
      coverUrl: coverArt || null,
      year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : new Date().getFullYear()
    }
  } catch {
    return null
  }
}

// Helper: Fetch synced karaoke lyrics
async function fetchLyrics(title, artist) {
  try {
    const query = new URLSearchParams({ track_name: title, artist_name: artist })
    const res = await fetch(`https://lrclib.net/api/get?${query.toString()}`, {
      headers: { 'User-Agent': 'ShadowMusicApp/2.0' }
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.syncedLyrics || data.plainLyrics || ''
  } catch {
    return ''
  }
}

// Helper: Upload file or buffer to Cloudflare R2
async function uploadToR2(key, body, contentType) {
  if (!s3) {
    throw new Error('Cloudflare R2 is not configured in .env. Please add R2 credentials to .env')
  }

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  }))

  return `${R2_PUBLIC_URL}/${key}`
}

async function main() {
  console.log('\n======================================================')
  console.log('       SHADOW MUSIC — AUTOMATED MUSIC INGESTION       ')
  console.log('======================================================\n')

  const stagingDir = path.resolve(__dirname, '../music_staging')
  const songsDir = path.resolve(stagingDir, 'songs')
  const artistsDir = path.resolve(stagingDir, 'artists')
  const completedDir = path.resolve(stagingDir, 'completed')

  if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true })
  if (!fs.existsSync(artistsDir)) fs.mkdirSync(artistsDir, { recursive: true })
  if (!fs.existsSync(completedDir)) fs.mkdirSync(completedDir, { recursive: true })

  if (!hasR2Config) {
    console.warn('⚠️  Notice: Cloudflare R2 credentials are not set in .env yet.')
    console.warn('    Open shadow-music-react/.env and fill in your R2 keys to upload.')
    console.warn('    Script will run in Preview/Validation mode.\n')
  }

  const audioFiles = fs.readdirSync(songsDir).filter(f => /\.(mp3|m4a|wav|flac)$/i.test(f))

  if (audioFiles.length === 0) {
    console.log(`📁 No new audio files found in: ${songsDir}`)
    console.log(`💡 Drop your MP3 files into the "music_staging/songs" folder and run this script again!\n`)
    process.exit(0)
  }

  console.log(`🎵 Found ${audioFiles.length} song(s) ready to process.\n`)

  // Cache existing artists from Firestore to prevent duplicate uploads
  const existingArtists = new Set()
  try {
    const artistSnap = await getDocs(collection(db, 'artists'))
    artistSnap.forEach(d => {
      existingArtists.add((d.id || '').toLowerCase())
      if (d.data()?.name) existingArtists.add(d.data().name.toLowerCase())
    })
  } catch (err) {
    console.warn('Notice: Could not pre-fetch existing artists, will check per artist.')
  }

  let successCount = 0

  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i]
    const filePath = path.join(songsDir, file)
    const baseName = path.parse(file).name
    console.log(`------------------------------------------------------`)
    console.log(`[${i + 1}/${audioFiles.length}] 🎧 Analyzing: ${file}`)

    try {
      // 1. Read metadata from file tags & cleaned filename
      const cleaned = cleanFilename(file)
      let tags = {}
      try {
        tags = await musicMetadata.parseFile(filePath)
      } catch (e) {
        // Tag read fallback
      }

      let title = tags.common?.title || cleaned.title || baseName
      let artist = tags.common?.artist || cleaned.artist || 'Unknown Artist'
      let album = tags.common?.album || 'Single'
      let duration = Math.round(tags.format?.duration || 210)
      let genre = tags.common?.genre?.[0] || 'Music'
      let year = tags.common?.year || new Date().getFullYear()

      console.log(`   🏷️  Detected: "${title}" by "${artist}"`)

      // 2. Fetch official artwork and clean metadata if available
      let coverBuffer = null
      let coverContentType = 'image/jpeg'
      let coverUrl = ''

      // A) Check embedded picture inside the MP3
      if (tags.common?.picture && tags.common.picture.length > 0) {
        coverBuffer = tags.common.picture[0].data
        coverContentType = tags.common.picture[0].format || 'image/jpeg'
        console.log(`   🖼️  Found embedded album cover in MP3`)
      }

      // B) Check matching local image in songs folder (e.g. SongName.jpg)
      if (!coverBuffer) {
        for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
          const matchingImg = path.join(songsDir, `${baseName}${ext}`)
          if (fs.existsSync(matchingImg)) {
            coverBuffer = fs.readFileSync(matchingImg)
            coverContentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
            console.log(`   🖼️  Found matching local image: ${baseName}${ext}`)
            break
          }
        }
      }

      // C) Auto-fetch official Apple Music / iTunes HD cover if no local image
      if (!coverBuffer) {
        console.log(`   🔎 Auto-fetching official HD cover art from Apple Music...`)
        const official = await fetchOfficialMetadata(title, artist)
        if (official) {
          title = official.title || title
          artist = official.artist || artist
          album = official.album || album
          genre = official.genre || genre
          year = official.year || year

          if (official.coverUrl) {
            try {
              const imgRes = await fetch(official.coverUrl)
              if (imgRes.ok) {
                coverBuffer = Buffer.from(await imgRes.arrayBuffer())
                console.log(`   ✅ Downloaded official 600x600 HD cover for "${album}"`)
              }
            } catch {
              coverUrl = official.coverUrl
            }
          }
        }
      }

      // 3. Auto-fetch synced karaoke lyrics
      console.log(`   📜 Fetching lyrics...`)
      const lyrics = await fetchLyrics(title, artist)
      if (lyrics) {
        console.log(`   ✅ Synced lyrics found (${lyrics.length} chars)`)
      } else {
        console.log(`   ℹ️  No synced lyrics found, can be added later`)
      }

      // 4. Generate unique clean song ID
      const songId = 'sm_' + crypto.createHash('md5').update(`${title}_${artist}`.toLowerCase()).digest('hex').slice(0, 10)

      // 5. Upload files to Cloudflare R2
      let finalAudioUrl = ''
      let finalCoverUrl = coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'

      if (hasR2Config) {
        console.log(`   ☁️  Uploading MP3 to Cloudflare R2 (tracks/${songId}.mp3)...`)
        const audioKey = `tracks/${songId}.mp3`
        finalAudioUrl = await uploadToR2(audioKey, fs.createReadStream(filePath), 'audio/mpeg')

        if (coverBuffer) {
          const coverKey = `covers/${songId}.jpg`
          console.log(`   ☁️  Uploading cover to Cloudflare R2 (covers/${songId}.jpg)...`)
          finalCoverUrl = await uploadToR2(coverKey, coverBuffer, coverContentType)
        }
      } else {
        finalAudioUrl = `https://r2.preview.local/tracks/${songId}.mp3`
        if (!coverUrl) finalCoverUrl = `https://r2.preview.local/covers/${songId}.jpg`
      }

      // 6. Handle Artist Profile (Upload Artist Photo ONLY ONCE)
      const artistKey = artist.trim()
      const artistSlug = artistKey.toLowerCase().replace(/[^a-z0-9]/g, '_')
      const isNewArtist = !existingArtists.has(artistKey.toLowerCase())

      if (isNewArtist) {
        console.log(`   👤 New artist detected: "${artistKey}". Setting up profile...`)
        let artistImgUrl = finalCoverUrl

        // Check if user provided an artist photo in music_staging/artists/
        for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
          const candidate = path.join(artistsDir, `${artistKey}${ext}`)
          if (fs.existsSync(candidate)) {
            console.log(`   🖼️  Found custom artist photo: ${artistKey}${ext}`)
            if (hasR2Config) {
              const artistR2Key = `artists/${artistSlug}${ext}`
              artistImgUrl = await uploadToR2(artistR2Key, fs.readFileSync(candidate), ext === '.png' ? 'image/png' : 'image/jpeg')
            }
            break
          }
        }

        // Save Artist document to Firestore
        await setDoc(doc(db, 'artists', artistKey), {
          name: artistKey,
          bio: `${artistKey} is an artist on Shadow Music.`,
          image: artistImgUrl,
          createdAt: Date.now()
        }, { merge: true })

        existingArtists.add(artistKey.toLowerCase())
        console.log(`   ✅ Artist profile created for "${artistKey}" (uploaded once!)`)
      } else {
        console.log(`   ✨ Artist "${artistKey}" already exists in database. Skipped duplicate photo upload.`)
      }

      // 7. Write Song Document into Firestore
      const songData = {
        id: songId,
        title,
        artist: artistKey,
        album,
        duration,
        genre,
        year,
        audioUrl: finalAudioUrl,
        coverUrl: finalCoverUrl,
        lyrics,
        createdAt: Date.now()
      }

      await setDoc(doc(db, 'songs', songId), songData, { merge: true })
      console.log(`   💾 Saved song record to Firestore: "${title}" (${songId})`)

      // 8. Move ingested file to completed folder
      fs.renameSync(filePath, path.join(completedDir, file))

      successCount++
      console.log(`   🎉 Successfully finished: ${file}\n`)
    } catch (err) {
      console.error(`   ❌ Error processing ${file}:`, err.message)
    }
  }

  console.log('======================================================')
  console.log(`✨ INGESTION COMPLETE: ${successCount} of ${audioFiles.length} songs processed successfully!`)
  console.log('======================================================\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error during ingestion:', err)
  process.exit(1)
})
