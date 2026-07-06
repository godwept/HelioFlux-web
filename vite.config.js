import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/helioviewer': {
        target: 'https://api.helioviewer.org/v2',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api\/helioviewer/, ''),
      },
      '/api/noaa': {
        target: 'https://services.swpc.noaa.gov',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api\/noaa/, ''),
      },
    },
  },
})
