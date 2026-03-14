import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '家庭記帳 APP',
        short_name: '家庭記帳',
        description: '專屬家庭的雲端記帳系統',
        theme_color: '#2563eb',
        background_color: '#111827',
        display: 'standalone',
        icons: [
          // 註：未來您可以自己放兩張 icon 圖檔到 public 資料夾中
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  base: '/my-ledger/', 
})