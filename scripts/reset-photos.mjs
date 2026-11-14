import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore'

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

async function resetPhotos() {
  console.log('\n======================================================')
  console.log('       SHADOW MUSIC — RESET COVERS & ARTIST PHOTOS     ')
  console.log('======================================================\n')
  console.log('Notice: Songs and Artists WILL NOT BE DELETED.')
  console.log('Only the coverUrl and image URLs will be cleared so')
  console.log('they can be re-populated cleanly using the new system.\n')

  try {
    // 1. Clear covers from all songs in Firestore
    console.log('1. Clearing covers from songs collection...')
    const songsSnap = await getDocs(collection(db, 'songs'))
    let songCount = 0
    for (const songDoc of songsSnap.docs) {
      await updateDoc(doc(db, 'songs', songDoc.id), {
        coverUrl: ''
      })
      songCount++
      console.log(`   - Cleared cover for song: ${songDoc.data()?.title || songDoc.id}`)
    }
    console.log(`✅ Cleared covers for ${songCount} songs.\n`)

    // 2. Clear photos from all artists in Firestore
    console.log('2. Clearing photos from artists collection...')
    const artistsSnap = await getDocs(collection(db, 'artists'))
    let artistCount = 0
    for (const artistDoc of artistsSnap.docs) {
      await updateDoc(doc(db, 'artists', artistDoc.id), {
        image: ''
      })
      artistCount++
      console.log(`   - Cleared photo for artist: ${artistDoc.data()?.name || artistDoc.id}`)
    }
    console.log(`✅ Cleared photos for ${artistCount} artists.\n`)

    console.log('======================================================')
    console.log('🎉 Reset complete! All songs are intact.')
    console.log('You can now run "Upload Music.bat" to add clean HD covers!')
    console.log('======================================================\n')
    process.exit(0)
  } catch (error) {
    console.error('❌ Reset failed:', error)
    process.exit(1)
  }
}

resetPhotos()
