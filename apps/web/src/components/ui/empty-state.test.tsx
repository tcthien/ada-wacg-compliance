import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './empty-state';
import { FolderOpen, Search, CheckCircle, Globe } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title correctly', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        title="No scans yet"
        description="Start your first scan to see results here"
      />
    );
    expect(screen.getByText('Start your first scan to see results here')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        title="No items"
        icon={<FolderOpen data-testid="folder-icon" />}
      />
    );
    expect(screen.getByTestId('folder-icon')).toBeInTheDocument();
  });

  it('renders primary action button with correct variant', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <EmptyState
        title="No scans"
        action={{
          label: 'Start Scan',
          onClick: handleClick,
          variant: 'primary',
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'Start Scan' });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders secondary action button with correct variant', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <EmptyState
        title="No scans"
        action={{
          label: 'Primary Action',
          onClick: handleClick,
          variant: 'secondary',
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'Primary Action' });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders both primary and secondary actions', () => {
    const primaryAction = vi.fn();
    const secondaryAction = vi.fn();

    render(
      <EmptyState
        title="No results"
        action={{
          label: 'Primary',
          onClick: primaryAction,
        }}
        secondaryAction={{
          label: 'Secondary',
          onClick: secondaryAction,
        }}
      />
    );

    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();
  });

  it('renders with all Lucide icons', () => {
    const { rerender } = render(
      <EmptyState
        title="Test"
        icon={<FolderOpen data-testid="icon" />}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();

    rerender(
      <EmptyState
        title="Test"
        icon={<Search data-testid="icon" />}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();

    rerender(
      <EmptyState
        title="Test"
        icon={<CheckCircle data-testid="icon" />}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();

    rerender(
      <EmptyState
        title="Test"
        icon={<Globe data-testid="icon" />}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState
        title="Test"
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders complete empty state with all props', async () => {
    const user = userEvent.setup();
    const primaryClick = vi.fn();
    const secondaryClick = vi.fn();

    render(
      <EmptyState
        icon={<FolderOpen data-testid="folder-icon" />}
        title="No scans yet"
        description="Start your first accessibility scan to see results here"
        action={{
          label: 'Start First Scan',
          onClick: primaryClick,
          variant: 'primary',
        }}
        secondaryAction={{
          label: 'Learn More',
          onClick: secondaryClick,
        }}
      />
    );

    expect(screen.getByTestId('folder-icon')).toBeInTheDocument();
    expect(screen.getByText('No scans yet')).toBeInTheDocument();
    expect(screen.getByText('Start your first accessibility scan to see results here')).toBeInTheDocument();

    const primaryButton = screen.getByRole('button', { name: 'Start First Scan' });
    const secondaryButton = screen.getByRole('button', { name: 'Learn More' });

    await user.click(primaryButton);
    expect(primaryClick).toHaveBeenCalledTimes(1);

    await user.click(secondaryButton);
    expect(secondaryClick).toHaveBeenCalledTimes(1);
  });
});
