import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';

// VITE_MSW=1 (pnpm run dev:mock, the mocked e2e suite) starts the mock worker
// before the app renders, so no journey can outrun the interception. The flag is
// baked out of production builds, which never carry the mocks.
async function enableMocks(): Promise<void> {
  if (import.meta.env.VITE_MSW !== '1') {
    return;
  }
  const { createWorker } = await import('./mocks/browser');
  await createWorker().start({ quiet: true, onUnhandledRequest: 'bypass' });
}

void enableMocks().then(() => {
  // Vite sets BASE_URL from `base` (VITE_BASE_PATH). BrowserRouter needs the
  // path without a trailing slash; root `/` stays the default (undefined).
  const base = import.meta.env.BASE_URL;
  const basename = base === '/' ? undefined : base.replace(/\/$/, '');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
