import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { VersionSwitcher } from './VersionSwitcher';

const meta = {
  title: 'Quotes/VersionSwitcher',
  component: VersionSwitcher,
  args: {
    version: 'v1',
    onChange: fn(),
  },
} satisfies Meta<typeof VersionSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MinimalApis: Story = {};

export const Controllers: Story = {
  args: { version: 'v0' },
};

export const ProtoAdapter: Story = {
  args: { version: 'v2' },
};

export const GrpcTranscoding: Story = {
  args: { version: 'v3' },
};

export const SwitchingTransport: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'v0 (controllers)' }));
    await expect(args.onChange).toHaveBeenCalledWith('v0');
    await userEvent.click(canvas.getByRole('radio', { name: 'v1 (minimal APIs)' }));
    await expect(args.onChange).toHaveBeenCalledWith('v1');
    await userEvent.click(canvas.getByRole('radio', { name: 'v2 (proto + adapter)' }));
    await expect(args.onChange).toHaveBeenCalledWith('v2');
    await userEvent.click(canvas.getByRole('radio', { name: 'v3 (gRPC-JSON)' }));
    await expect(args.onChange).toHaveBeenCalledWith('v3');
  },
};
