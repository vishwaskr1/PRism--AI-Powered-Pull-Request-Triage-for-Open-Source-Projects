import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // The Three.js renderer is a lazy chunk used only on the landing hero (about 567 KB minified / 142 KB gzip).
    // Raise the warning threshold slightly for that intentionally deferred vendor chunk.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "three-vendor", test: /node_modules\/three\// }],
        },
      },
    },
  },
})
