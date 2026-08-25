import { setupWorker } from 'msw/browser';
import { createHandlers } from './handlers';

/**
 * The browser-side MSW worker. Started by src/main.tsx when the dev server runs
 * with mocking enabled (VITE_MSW=1), and by Storybook's mswLoader. Every start
 * creates a fresh handler set: one per browser session — so each mocked-e2e
 * scenario's context pages through its own seeded catalog — and one per
 * Storybook session, shared by that session's stories.
 */
export function createWorker() {
  return setupWorker(...createHandlers());
}
