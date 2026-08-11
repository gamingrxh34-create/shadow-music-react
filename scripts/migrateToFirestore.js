import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const firebaseConfig = {
  apiKey: "AIzaSyBRcZ9DtwkFYBDuABbK2bzPwaArHlk0YRg",
  authDomain: "shadow-music-f2b43.firebaseapp.com",
  projectId: "shadow-music-f2b43",
  storageBucket: "shadow-music-f2b43.firebasestorage.app",
  messagingSenderId: "605927658698",
  appId: "1:605927658698:web:b499f6944beab9e3521033"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function migrate() {
  console.log('Starting migration...')
  
  try {
    // Artists
    const artistsPath = path.join(__dirname, '..', 'public', 'data', 'artists.json')
    const artistsData = JSON.parse(await fs.readFile(artistsPath, 'utf8'))
    
    console.log('Migrating artists...')
    for (const [key, value] of Object.entries(artistsData)) {
      await setDoc(doc(db, 'artists', key), {
        id: key,
        ...value,
        createdAt: Date.now()
      })
      console.log(`- Migrated artist: ${key}`)
    }

    // Songs
    const songsPath = path.join(__dirname, '..', 'public', 'data', 'songs.json')
    const songsData = JSON.parse(await fs.readFile(songsPath, 'utf8'))
    
    console.log('Migrating songs...')
    for (const song of songsData) {
      await setDoc(doc(db, 'songs', song.id), {
        ...song,
        createdAt: Date.now()
      })
      console.log(`- Migrated song: ${song.id}`)
    }
    
    console.log('Migration complete!')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrate()
