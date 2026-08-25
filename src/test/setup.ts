import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '../mocks/server';

beforeAll(() => {
  // Unhandled requests are bugs: either the code under test calls an endpoint the
  // handlers do not cover, or a test forgot to stub something. Both fail loudly
  // here instead of silently hitting a real network.
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
  sessionStorage.clear();
});

afterAll(() => {
  server.close();
});
