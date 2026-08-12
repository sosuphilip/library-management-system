/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // Set VITE_BASE=/library-management-system/ when deploying to GitHub Pages
  // (project site sub-path). Leave unset for local dev / root hosting.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
});
