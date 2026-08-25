import type { Preview } from '@storybook/react';
import type { SetupWorker } from 'msw/browser';
// The components style themselves with the app's global sheet, so stories render as
// they do inside the SPA.
import '../src/index.css';
import '../src/App.css';
import { createWorker } from '../src/mocks/browser';

// msw 2.15 dropped its storybook loader; this keeps the same contract in three
// lines: the mock worker starts once per Storybook session, quietly. Today's
// stories are pure-props components that make no requests, so unhandled requests
// pass through; stories that want the mocked platform can use the worker directly.
let worker: SetupWorker | undefined;
let started: Promise<void> | undefined;

async function mswLoader(): Promise<Record<string, never>> {
  worker ??= createWorker();
  started ??= worker.start({ quiet: true, onUnhandledRequest: 'bypass' }).then(() => undefined);
  await started;
  return {};
}

const preview: Preview = {
  parameters: {
    layout: 'centered',
  },
  loaders: [mswLoader],
};

export default preview;
