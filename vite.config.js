import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 🌟 新增：包含所有靜態資源，確保離線可用
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: '家庭記帳 APP',
        short_name: '家庭記帳',
        description: '專屬家庭的雲端記帳系統',
        theme_color: '#2563eb',
        background_color: '#111827',
        display: 'standalone',
        icons: [
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      // 🌟 核心：設定 Workbox 緩存策略
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg}'], // 快取所有檔案類型
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } // 快取一年
            }
          }
        ]
      }
    })
  ],
  base: '/my-ledger/', 
})