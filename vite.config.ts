import react from '@vitejs/plugin-react'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
      },
      preload: {
        input: path.join(__dirname, 'src/preload/index.ts'),
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
})
