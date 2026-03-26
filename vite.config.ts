import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: 'src-new',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../src/test-setup.ts'],
    include: ['../src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['../src/**/*.{ts,tsx}'],
    },
  },
})
