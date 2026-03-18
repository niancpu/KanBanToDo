import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const debugLogFile = path.resolve(__dirname, 'debug.log')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    {
      name: 'debug-log',
      configureServer(server) {
        server.middlewares.use('/debug-log', (req, res) => {
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', () => {
              fs.appendFileSync(debugLogFile, body + '\n')
              res.writeHead(200)
              res.end('ok')
            })
          } else {
            res.writeHead(405)
            res.end()
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
