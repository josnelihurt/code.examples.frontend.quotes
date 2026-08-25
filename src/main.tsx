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
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
