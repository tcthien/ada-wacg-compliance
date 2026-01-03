/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WcagLevelSelector } from './WcagLevelSelector';

describe('WcagLevelSelector', () => {
  it('renders all three WCAG levels', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AA" onChange={onChange} />);

    expect(screen.getByDisplayValue('A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('AA')).toBeInTheDocument();
    expect(screen.getByDisplayValue('AAA')).toBeInTheDocument();
  });

  it('calls onChange when a different level is selected', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AA" onChange={onChange} />);

    const levelAInput = screen.getByDisplayValue('A') as HTMLInputElement;
    fireEvent.click(levelAInput);

    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('displays the currently selected level', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AAA" onChange={onChange} />);

    const levelAAAInput = screen.getByDisplayValue('AAA') as HTMLInputElement;
    expect(levelAAAInput.checked).toBe(true);
  });

  it('shows level descriptions', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AA" onChange={onChange} />);

    expect(screen.getByText(/Basic accessibility requirements/)).toBeInTheDocument();
    expect(screen.getByText(/Enhanced accessibility/)).toBeInTheDocument();
    expect(screen.getByText(/Highest accessibility standard/)).toBeInTheDocument();
  });

  it('can be disabled', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AA" onChange={onChange} disabled />);

    const levelAInput = screen.getByDisplayValue('A') as HTMLInputElement;
    expect(levelAInput.disabled).toBe(true);
  });

  it('shows help section when showHelp is true', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AA" onChange={onChange} showHelp={true} />);

    expect(screen.getByText(/Learn more about WCAG levels/)).toBeInTheDocument();
  });

  it('hides help section when showHelp is false', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AA" onChange={onChange} showHelp={false} />);

    expect(screen.queryByText(/Learn more about WCAG levels/)).not.toBeInTheDocument();
  });

  it('renders info icons for each level when showHelp is true', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AA" onChange={onChange} showHelp={true} />);

    const infoButtons = screen.getAllByRole('button', { name: /More information about/ });
    expect(infoButtons).toHaveLength(3);
  });

  it('does not render info icons when showHelp is false', () => {
    const onChange = vi.fn();
    render(<WcagLevelSelector value="AA" onChange={onChange} showHelp={false} />);

    const infoButtons = screen.queryAllByRole('button', { name: /More information about/ });
    expect(infoButtons).toHaveLength(0);
  });
});
