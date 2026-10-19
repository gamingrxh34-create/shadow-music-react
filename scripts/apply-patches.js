import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const srcFile = path.resolve(__dirname, 'patches', 'MediaSessionPlugin.java')
const destDir = path.resolve(__dirname, '..', 'node_modules', '@jofr', 'capacitor-media-session', 'android', 'src', 'main', 'java', 'io', 'github', 'jofr', 'capacitor', 'mediasessionplugin')
const destFile = path.resolve(destDir, 'MediaSessionPlugin.java')

if (fs.existsSync(srcFile) && fs.existsSync(destDir)) {
  fs.copyFileSync(srcFile, destFile)
  console.log('Successfully applied MediaSessionPlugin patch for robust offline playback.')
}
