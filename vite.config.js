import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/google-token-proxy': {
        target: 'https://oauth2.googleapis.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/google-token-proxy/, '/token'),
      },
      '/google-gmail-proxy': {
        target: 'https://gmail.googleapis.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/google-gmail-proxy/, ''),
      },
      '/zoho-token-proxy': {
        target: 'https://accounts.zoho.in',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/zoho-token-proxy/, ''),
      },
      '/zoho-mail-proxy': {
        target: 'https://mail.zoho.in',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/zoho-mail-proxy/, ''),
      }
    }
  }
})
