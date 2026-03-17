import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:4800',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'markdown': ['react-markdown', 'remark-gfm'],
          'icons': ['lucide-react'],
          'stores': ['zustand'],
        },
      },
    },
  },
})
