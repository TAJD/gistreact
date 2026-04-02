import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    cloudflare({
      // Use wrangler config for static assets
      configPath: "./wrangler.jsonc"
    })
  ],
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      output: {
        manualChunks: {
          'sandpack': ['@codesandbox/sandpack-react'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  }
})