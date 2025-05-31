import { defineConfig } from 'vite'
import fs from 'fs'
import mkcert from 'vite-plugin-mkcert'

//
export default defineConfig({
  plugins: [ mkcert() ],
  server: {
    /*https: {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem'),
    },*/
    port: 5173,
    headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp"
    }
  }
})
