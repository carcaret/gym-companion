import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: '.',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['./src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['./src/**/*.{ts,tsx}'],
    },
  },
})
