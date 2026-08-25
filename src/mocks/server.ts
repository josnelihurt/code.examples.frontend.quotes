import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * The Node-side MSW server for unit tests (started by src/test/setup.ts). Tests
 * override behavior with `server.use(...)`; resetHandlers in the global afterEach
 * restores these defaults after every test.
 */
export const server = setupServer(...handlers);
