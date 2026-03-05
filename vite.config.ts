import react from '@vitejs/plugin-react'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const mainAlias = {
  '@main': path.resolve(__dirname, 'src/main'),
  '@shared': path.resolve(__dirname, 'src/shared'),
}

const rendererAlias = {
  '@main': path.resolve(__dirname, 'src/main'),
  '@renderer': path.resolve(__dirname, 'src/renderer'),
  '@shared': path.resolve(__dirname, 'src/shared'),
}

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          resolve: {
            alias: mainAlias,
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'src/preload/index.ts'),
        vite: {
          resolve: {
            alias: mainAlias,
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: rendererAlias,
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
})
