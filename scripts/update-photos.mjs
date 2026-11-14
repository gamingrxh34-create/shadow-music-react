import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore'
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

const hasR2Config = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_PUBLIC_URL)

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

// Upload file to Cloudflare R2
async function uploadToR2(key, body, contentType) {
  if (!s3) throw new Error('R2 not configured')
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  }))
  return `${R2_PUBLIC_URL}/${key}`
}

// Helper: Query Apple Music for official 600x600 HD song cover
async function fetchAppleMusicCover(title, artist) {
  try {
    const query = encodeURIComponent(`${artist} ${title}`.trim())
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.results || data.results.length === 0) return null
    const art = data.results[0].artworkUrl100
    if (!art) return null
    return art.replace('100x100bb.jpg', '600x600bb.jpg')
  } catch {
    return null
  }
}

// Helper: Query Deezer API for official 1000x1000 HD artist portrait
async function fetchDeezerArtistPhoto(artistName) {
  try {
    const query = encodeURIComponent(artistName.trim())
    const res = await fetch(`https://api.deezer.com/search/artist?q=${query}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.data || data.data.length === 0) return null
    const match = data.data[0]
    return match.picture_xl || match.picture_big || match.picture_medium || null
  } catch {
    return null
  }
}

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function main() {
  console.log('\n======================================================')
  console.log('       SHADOW MUSIC — SMART PHOTO & COVER UPDATER      ')
  console.log('======================================================\n')

  const stagingDir = path.resolve(__dirname, '../music_staging')
  const coversDir = path.resolve(stagingDir, 'covers')
  const artistsDir = path.resolve(stagingDir, 'artists')
  const completedDir = path.resolve(stagingDir, 'completed')

  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true })
  if (!fs.existsSync(artistsDir)) fs.mkdirSync(artistsDir, { recursive: true })
  if (!fs.existsSync(completedDir)) fs.mkdirSync(completedDir, { recursive: true })

  // 1. Fetch all songs & artists from Firestore
  console.log('📡 Connecting to Firestore...')
  const [songsSnap, artistsSnap] = await Promise.all([
    getDocs(collection(db, 'songs')),
    getDocs(collection(db, 'artists'))
  ])

  console.log(`   Found ${songsSnap.docs.length} songs and ${artistsSnap.docs.length} artists in database.\n`)

  // Check local files
  const imageExtensions = /\.(jpg|jpeg|png|webp|jfif|avif)$/i
  const localCoverFiles = fs.readdirSync(coversDir).filter(f => imageExtensions.test(f))
  const localArtistFiles = fs.readdirSync(artistsDir).filter(f => imageExtensions.test(f))

  console.log(`📂 Local staging folders:`)
  console.log(`   - "music_staging/covers":  ${localCoverFiles.length} file(s)`)
  console.log(`   - "music_staging/artists": ${localArtistFiles.length} file(s)\n`)

  if (hasR2Config) {
    console.log(`☁️  Cloudflare R2 is configured: Local photos will be uploaded to R2.`)
  } else if (localCoverFiles.length > 0 || localArtistFiles.length > 0) {
    console.warn(`⚠️  Notice: Local images found, but Cloudflare R2 is not configured in .env yet.`)
    console.warn(`   Official HD covers from Apple Music & Deezer will be used directly.\n`)
  }

  // ----------------------------------------------------
  // 2. UPDATE ARTIST PHOTOS
  // ----------------------------------------------------
  console.log('======================================================')
  console.log('  1. UPDATING ARTIST PHOTOS (1000x1000 HD)')
  console.log('======================================================')

  let updatedArtists = 0

  for (const aDoc of artistsSnap.docs) {
    const artistData = aDoc.data()
    const artistName = artistData.name || aDoc.id
    const currentImage = artistData.image || ''

    console.log(`\n🎤 Artist: "${artistName}"`)

    // Check if user dropped a local image in music_staging/artists/
    const matchingLocalFile = localArtistFiles.find(f => {
      const base = path.parse(f).name
      return normalize(base) === normalize(artistName)
    })

    let newImageUrl = null

    if (matchingLocalFile && hasR2Config) {
      console.log(`   Found local photo: ${matchingLocalFile}`)
      const filePath = path.join(artistsDir, matchingLocalFile)
      const ext = path.extname(matchingLocalFile).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
      const key = `artists/${crypto.randomBytes(4).toString('hex')}_${encodeURIComponent(artistName)}${ext}`
      const buffer = fs.readFileSync(filePath)
      newImageUrl = await uploadToR2(key, buffer, mime)
      console.log(`   ☁️ Uploaded to R2: ${newImageUrl}`)

      // Move to completed
      fs.renameSync(filePath, path.join(completedDir, matchingLocalFile))
    } else {
      // Auto-fetch from Deezer
      console.log(`   🔍 Auto-fetching official HD portrait from Deezer...`)
      newImageUrl = await fetchDeezerArtistPhoto(artistName)
    }

    if (newImageUrl) {
      await updateDoc(doc(db, 'artists', aDoc.id), { image: newImageUrl })
      console.log(`   ✅ Photo updated successfully! (${newImageUrl.slice(0, 70)}...)`)
      updatedArtists++
    } else {
      console.log(`   ⚠️ Could not find photo for "${artistName}". Kept as is.`)
    }
  }

  // ----------------------------------------------------
  // 3. UPDATE SONG COVERS
  // ----------------------------------------------------
  console.log('\n======================================================')
  console.log('  2. UPDATING SONG COVERS (600x600 Official Artwork)')
  console.log('======================================================')

  let updatedSongs = 0

  for (let i = 0; i < songsSnap.docs.length; i++) {
    const sDoc = songsSnap.docs[i]
    const songData = sDoc.data()
    const title = songData.title || ''
    const artist = songData.artist || ''

    process.stdout.write(`[${i + 1}/${songsSnap.docs.length}] "${title}" by ${artist}... `)

    // Check local cover first
    const matchingLocalCover = localCoverFiles.find(f => {
      const base = path.parse(f).name
      return normalize(base) === normalize(title) || normalize(base) === normalize(`${artist} ${title}`)
    })

    let newCoverUrl = null

    if (matchingLocalCover && hasR2Config) {
      const filePath = path.join(coversDir, matchingLocalCover)
      const ext = path.extname(matchingLocalCover).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
      const key = `covers/${crypto.randomBytes(4).toString('hex')}_${encodeURIComponent(title)}${ext}`
      const buffer = fs.readFileSync(filePath)
      newCoverUrl = await uploadToR2(key, buffer, mime)

      // Move to completed
      fs.renameSync(filePath, path.join(completedDir, matchingLocalCover))
    } else {
      // Auto-fetch from Apple Music
      newCoverUrl = await fetchAppleMusicCover(title, artist)
    }

    if (newCoverUrl) {
      await updateDoc(doc(db, 'songs', sDoc.id), { coverUrl: newCoverUrl })
      console.log(`✅ Updated`)
      updatedSongs++
    } else {
      console.log(`⚠️ Not found`)
    }
  }

  console.log('\n======================================================')
  console.log('🎉 ALL DONE!')
  console.log(`   - Artists updated: ${updatedArtists}/${artistsSnap.docs.length}`)
  console.log(`   - Song covers updated: ${updatedSongs}/${songsSnap.docs.length}`)
  console.log('======================================================\n')
}

main().catch(err => {
  console.error('\n❌ Error updating photos:', err)
  process.exit(1)
})
