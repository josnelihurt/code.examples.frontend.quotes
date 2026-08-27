import { defineConfig, type ServerOptions } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { HmrOptions } from 'vite';

// Aspire WithReference injects AUTH_API_HTTP/HTTPS and QUOTES_API_HTTP/HTTPS for resources auth-api / quotes-api.
const authTarget = process.env.AUTH_API_HTTPS || process.env.AUTH_API_HTTP;
const quotesTarget = process.env.QUOTES_API_HTTPS || process.env.QUOTES_API_HTTP;

// Optional reverse-proxy / edge knobs. Every host that mounts this SPA (Aspire,
// compose+Traefik, plain `pnpm run dev`) sets only what it needs; all unset
// keeps stock Vite HMR on :5173.
//
//   VITE_DEV_ORIGIN       — server.origin (browser-facing URL for asset links)
//   VITE_SERVER_HOST      — server.host (`true` / `0.0.0.0` for containers)
//   VITE_HMR_HOST         — hmr.host
//   VITE_HMR_CLIENT_PORT  — hmr.clientPort (browser-facing HMR port)
//   VITE_HMR_PROTOCOL     — hmr.protocol (`ws` | `wss`)
//
// If only VITE_DEV_ORIGIN is set, HMR host/port/protocol are derived from it
// so a single-port edge needs one env. Explicit VITE_HMR_* always win.
function serverFromEnv(): ServerOptions {
  const origin = process.env.VITE_DEV_ORIGIN;
  const serverHost = process.env.VITE_SERVER_HOST;
  const hmrHost = process.env.VITE_HMR_HOST;
  const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT;
  const hmrProtocol = process.env.VITE_HMR_PROTOCOL;

  const server: ServerOptions = {};
  if (serverHost !== undefined) {
    server.host = serverHost === 'true' ? true : serverHost;
  }
  if (origin !== undefined) {
    server.origin = origin;
  }

  const hmr: HmrOptions = {};
  if (hmrHost !== undefined) {
    hmr.host = hmrHost;
  }
  if (hmrClientPort !== undefined && hmrClientPort !== '') {
    const port = Number(hmrClientPort);
    if (Number.isFinite(port)) {
      hmr.clientPort = port;
    }
  }
  if (hmrProtocol === 'ws' || hmrProtocol === 'wss') {
    hmr.protocol = hmrProtocol;
  }

  if (origin !== undefined) {
    try {
      const url = new URL(origin);
      if (hmr.clientPort === undefined) {
        if (url.port) {
          hmr.clientPort = Number(url.port);
        } else if (url.protocol === 'https:') {
          hmr.clientPort = 443;
        } else if (url.protocol === 'http:') {
          hmr.clientPort = 80;
        }
      }
      if (hmr.host === undefined && url.hostname) {
        hmr.host = url.hostname;
      }
      if (hmr.protocol === undefined) {
        hmr.protocol = url.protocol === 'https:' ? 'wss' : 'ws';
      }
    } catch {
      // Malformed origin: leave HMR alone; Vite will use its defaults.
    }
  }

  if (Object.keys(hmr).length > 0) {
    server.hmr = hmr;
  }
  return server;
}

export default defineConfig({
  plugins: [react()],
  server: {
    ...serverFromEnv(),
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
