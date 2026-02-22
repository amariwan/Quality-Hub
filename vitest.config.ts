import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    // use jsdom so React components can render during unit tests
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{spec.ts,spec.tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});
