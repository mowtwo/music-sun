import { defineConfig } from 'vite'

export default defineConfig({
  base: '/music-sun/',
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
