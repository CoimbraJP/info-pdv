import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker novo assume na hora (skipWaiting/clientsClaim). O app não
      // recarrega sozinho (o carrinho está em memória): src/components/UpdateBanner.jsx
      // registra o SW e mostra "Nova versão disponível — Atualizar".
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true, // a aba aberta passa para o SW novo → dispara o aviso
      },
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'INFO CENTRO - Gestão',
        short_name: 'INFO CENTRO',
        description: 'Sistema completo de gestão comercial e operacional',
        theme_color: '#FFD700',
        background_color: '#0d0d0d',
        display: 'standalone',
        icons: [
          {
            src: 'logo-square.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo-square.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
