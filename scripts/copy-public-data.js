/**
 * Copia JSON grandes a public/data/ para poder cargarlos por URL (fetch en worker o lazy).
 * Ejecutar antes de dev/build si se usa el worker de parseo.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicData = path.join(root, 'public', 'data')
const srcData = path.join(root, 'src', 'data')

const files = ['airbnb.json', 'google-review.json', 'noticias.json']

if (!fs.existsSync(publicData)) {
  fs.mkdirSync(publicData, { recursive: true })
}

for (const name of files) {
  const src = path.join(srcData, name)
  const dest = path.join(publicData, name)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log(`Copied ${name} to public/data/`)
  }
}
