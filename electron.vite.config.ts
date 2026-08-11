import { readFileSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// The version is baked into the main bundle so the title bar and updater always
// report the real package version, even when Electron cannot locate package.json
// (launching the built main entry directly).
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    build: {
      outDir: 'out/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload'
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'out/renderer'
    }
  }
})
