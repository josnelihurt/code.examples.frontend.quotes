import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Aspire WithReference injects AUTH_API_HTTP/HTTPS and QUOTES_API_HTTP/HTTPS for resources auth-api / quotes-api.
const authTarget = process.env.AUTH_API_HTTPS || process.env.AUTH_API_HTTP;
const quotesTarget = process.env.QUOTES_API_HTTPS || process.env.QUOTES_API_HTTP;
// When the SPA is reached through a reverse proxy (compose Traefik on one host
// port), VITE_DEV_ORIGIN is the browser-facing origin so HMR websockets land
// on that port instead of Vite's in-container :5173. Unset keeps the default
// localhost:5173 HMR path for `pnpm run dev` outside compose.
const edgeOrigin = process.env.VITE_DEV_ORIGIN;
const edgeServer =
  edgeOrigin === undefined
    ? {}
    : {
        host: true as const,
        origin: edgeOrigin,
        hmr: { clientPort: Number(new URL(edgeOrigin).port || 8080) },
      };

export default defineConfig({
  plugins: [react()],
  server: {
    ...edgeServer,
    proxy: {
      '/api/v1/auth': {
        target: authTarget,
        changeOrigin: true,
        secure: false,
      },
      '/api/v1/quotes': {
        target: quotesTarget,
        changeOrigin: true,
        secure: false,
      },
      // All quote versions live in the same service and the SPA can switch at request
      // time; every version segment needs its own rule or the un-proxied requests hit
      // the dev server itself (that missing v0 rule once broke the controllers radio).
      '/api/v0/quotes': {
        target: quotesTarget,
        changeOrigin: true,
        secure: false,
      },
      '/api/v2/quotes': {
        target: quotesTarget,
        changeOrigin: true,
        secure: false,
      },
      '/api/v3/quotes': {
        target: quotesTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      // Sonar reads lcov; text keeps the terminal run readable.
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.tsx',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/api/schema.d.ts',
      ],
    },
  },
});
