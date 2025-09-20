import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    // Proxy API to Node gateway in dev
    proxy: {
      '/api/v1': {
        target: 'http://localhost:9080',
        changeOrigin: true,
      }
    },
  },
})
