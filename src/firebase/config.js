import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyBRcZ9DtwkFYBDuABbK2bzPwaArHlk0YRg",
  authDomain: "shadow-music-f2b43.firebaseapp.com",
  projectId: "shadow-music-f2b43",
  storageBucket: "shadow-music-f2b43.firebasestorage.app",
  messagingSenderId: "605927658698",
  appId: "1:605927658698:web:b499f6944beab9e3521033"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
