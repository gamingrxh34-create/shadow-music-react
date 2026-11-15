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

// Smart resolver for local files: R2 -> Cloudinary check -> Free CDN (Catbox)
async function uploadOrResolveImage(filePath, originalFilename, prefix = 'covers') {
  // 1. If R2 is configured, upload to Cloudflare R2
  if (hasR2Config) {
    const ext = path.extname(originalFilename).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    const key = `${prefix}/${crypto.randomBytes(4).toString('hex')}_${encodeURIComponent(path.parse(originalFilename).name)}${ext}`
    const buffer = fs.readFileSync(filePath)
    return await uploadToR2(key, buffer, mime)
  }

  // 2. Check if file is already live on the user's Cloudinary account
  const cloudName = 'dytac5x9v'
  const cloudinaryCandidate = `https://res.cloudinary.com/${cloudName}/image/upload/${encodeURIComponent(originalFilename)}`
  try {
    const headRes = await fetch(cloudinaryCandidate, { method: 'HEAD' })
    if (headRes.ok) {
      console.log(`\n   ☁️ Matched live image on Cloudinary CDN!`)
      return cloudinaryCandidate
    }
  } catch {}

  // 3. Auto-upload to free permanent image CDN (catbox.moe)
  console.log(`\n   ☁️ Uploading local image to fast CDN...`)
  try {
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(originalFilename).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    const form = new FormData()
    form.append('reqtype', 'fileupload')
    form.append('fileToUpload', new Blob([buf], { type: mime }), originalFilename)
    const catRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form })
    if (catRes.ok) {
      const hostedUrl = (await catRes.text()).trim()
      if (hostedUrl.startsWith('http')) {
        console.log(`   ☁️ Uploaded successfully!`)
        return hostedUrl
      }
    }
  } catch (err) {
    console.warn(`   ⚠️ CDN upload notice:`, err.message)
  }

  return null
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

function matchesSong(filename, title, artist) {
  const base = path.parse(filename).name
  const nFile = normalize(base)
  const nTitle = normalize(title)
  const nCombo1 = normalize(`${artist} ${title}`)
  const nCombo2 = normalize(`${title} ${artist}`)

  if (nFile === nTitle || nFile === nCombo1 || nFile === nCombo2) return true
  if (nTitle.length >= 4 && (nFile.startsWith(nTitle) || nFile.includes(nTitle))) return true
  if (nFile.length >= 4 && (nTitle.startsWith(nFile) || nTitle.includes(nFile))) return true
  return false
}

function matchesArtist(filename, artistName) {
  const base = path.parse(filename).name
  const nFile = normalize(base)
  const nArtist = normalize(artistName)

  if (nFile === nArtist) return true
  if (nArtist.length >= 3 && (nFile.startsWith(nArtist) || nFile.includes(nArtist))) return true
  if (nFile.length >= 3 && (nArtist.startsWith(nFile) || nArtist.includes(nFile))) return true
  return false
}

async function main() {
  console.log('\n======================================================')
  console.log('       SHADOW MUSIC — SMART PHOTO AND COVER UPDATER     ')
  console.log('======================================================\n')

  const stagingDir = path.resolve(__dirname, '../music_staging')
  const coversDir = path.resolve(stagingDir, 'covers')
  const artistsDir = path.resolve(stagingDir, 'artists')
  const completedDir = path.resolve(stagingDir, 'completed')

  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true })
  if (!fs.existsSync(artistsDir)) fs.mkdirSync(artistsDir, { recursive: true })
  if (!fs.existsSync(completedDir)) fs.mkdirSync(completedDir, { recursive: true })

  // 1. Fetch all songs and artists from Firestore
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
    console.log(`\n🎤 Artist: "${artistName}"`)

    // Check if user dropped a local image in music_staging/artists/
    const matchingLocalFile = localArtistFiles.find(f => matchesArtist(f, artistName))

    let newImageUrl = null

    if (matchingLocalFile) {
      console.log(`   🖼️ Found local photo: ${matchingLocalFile}`)
      const filePath = path.join(artistsDir, matchingLocalFile)
      newImageUrl = await uploadOrResolveImage(filePath, matchingLocalFile, 'artists')

      // Move to completed
      if (fs.existsSync(filePath)) {
        try {
          fs.copyFileSync(filePath, path.join(completedDir, matchingLocalFile))
          fs.unlinkSync(filePath)
        } catch {}
      }
    } else {
      // Auto-fetch from Deezer
      console.log(`   🔍 Auto-fetching official HD portrait from Deezer...`)
      newImageUrl = await fetchDeezerArtistPhoto(artistName)
    }

    const currentImage = artistData.image || ''
    if (newImageUrl) {
      await updateDoc(doc(db, 'artists', aDoc.id), { image: newImageUrl })
      console.log(`   ✅ Photo updated successfully! (${newImageUrl.slice(0, 65)}...)`)
      updatedArtists++
    } else if (currentImage) {
      console.log(`   ✨ Kept existing photo!`)
      updatedArtists++
    } else {
      console.log(`   ⚠️ Could not find photo for "${artistName}". Kept as is.`)
    }
  }

  // ----------------------------------------------------
  // 3. UPDATE SONG COVERS
  // ----------------------------------------------------
  console.log('\n======================================================')
  console.log('  2. UPDATING SONG COVERS')
  console.log('======================================================')

  let updatedSongs = 0

  for (let i = 0; i < songsSnap.docs.length; i++) {
    const sDoc = songsSnap.docs[i]
    const songData = sDoc.data()
    const title = songData.title || ''
    const artist = songData.artist || ''
    const currentCover = songData.coverUrl || ''

    process.stdout.write(`[${i + 1}/${songsSnap.docs.length}] "${title}" by ${artist}... `)

    // Check local cover first with smart matching
    const matchingLocalCover = localCoverFiles.find(f => matchesSong(f, title, artist))

    let newCoverUrl = null

    if (matchingLocalCover) {
      const filePath = path.join(coversDir, matchingLocalCover)
      newCoverUrl = await uploadOrResolveImage(filePath, matchingLocalCover, 'covers')

      // Move to completed
      if (fs.existsSync(filePath)) {
        try {
          fs.copyFileSync(filePath, path.join(completedDir, matchingLocalCover))
          fs.unlinkSync(filePath)
        } catch {}
      }
    } else {
      // Auto-fetch from Apple Music
      newCoverUrl = await fetchAppleMusicCover(title, artist)
    }

    if (newCoverUrl) {
      await updateDoc(doc(db, 'songs', sDoc.id), { coverUrl: newCoverUrl })
      console.log(`✅ Updated`)
      updatedSongs++
    } else if (currentCover) {
      console.log(`✨ Kept existing cover`)
      updatedSongs++
    } else {
      console.log(`⚠️ Not found (Drop image in covers folder)`)
    }
  }

  console.log('\n======================================================')
  console.log('🎉 ALL DONE!')
  console.log(`   - Artists updated: ${updatedArtists}/${artistsSnap.docs.length}`)
  console.log(`   - Song covers updated: ${updatedSongs}/${songsSnap.docs.length}`)
  console.log('======================================================')

  // 4. Ensure all staging drop folders are 100% clean and empty
  console.log('🧹 Cleaning up staging drop folders...')
  for (const dir of [coversDir, artistsDir]) {
    if (fs.existsSync(dir)) {
      const remaining = fs.readdirSync(dir)
      for (const file of remaining) {
        const src = path.join(dir, file)
        const dest = path.join(completedDir, file)
        try {
          fs.copyFileSync(src, dest)
          fs.unlinkSync(src)
        } catch {}
      }
    }
  }
  console.log('✨ "covers" and "artists" folders are now completely empty and ready for next batch!\n')
}

main().catch(err => {
  console.error('\n❌ Error updating photos:', err)
  process.exit(1)
})
