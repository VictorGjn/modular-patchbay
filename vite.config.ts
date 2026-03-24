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
  optimizeDeps: {
    include: [
      'react-force-graph-2d',
      'force-graph',
      'd3-quadtree',
      'd3-array',
      'd3-scale',
      'd3-scale-chromatic',
      'd3-force-3d',
      'lodash-es',
      'kapsule',
    ],
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor';
          }
          if (id.includes('node_modules/react-markdown/') || id.includes('node_modules/remark-gfm/')) {
            return 'markdown';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons';
          }
          if (id.includes('node_modules/zustand/')) {
            return 'stores';
          }
          if (id.includes('node_modules/mermaid/')) {
            return 'mermaid';
          }
          if (id.includes('/src/services/')) {
            return 'services';
          }
        },
      },
    },
  },
})
