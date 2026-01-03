import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkipLink } from './SkipLink';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SkipLink', () => {
  beforeEach(() => {
    // Clean up the DOM before each test
    document.body.innerHTML = '';

    // Mock scrollIntoView which is not supported in jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders with default props', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('#main-content');
  });

  it('renders with custom text', () => {
    render(<SkipLink>Skip to navigation</SkipLink>);
    const link = screen.getByText('Skip to navigation');
    expect(link).toBeDefined();
  });

  it('renders with custom targetId', () => {
    render(<SkipLink targetId="custom-target">Skip to custom</SkipLink>);
    const link = screen.getByText('Skip to custom');
    expect(link.getAttribute('href')).toBe('#custom-target');
  });

  it('has sr-only class by default', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');
    expect(link.className).toContain('sr-only');
  });

  it('focuses target element when clicked', () => {
    // Create target element
    const target = document.createElement('main');
    target.id = 'main-content';
    document.body.appendChild(target);

    // Mock focus to track if it was called
    const focusSpy = vi.spyOn(target, 'focus');

    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');

    fireEvent.click(link);

    // Verify focus was called on target
    expect(focusSpy).toHaveBeenCalled();
    expect(target.getAttribute('tabindex')).toBe('-1');
  });

  it('adds tabindex to target if not present', () => {
    const target = document.createElement('div');
    target.id = 'main-content';
    document.body.appendChild(target);

    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');

    expect(target.hasAttribute('tabindex')).toBe(false);

    fireEvent.click(link);

    expect(target.getAttribute('tabindex')).toBe('-1');
  });

  it('handles missing target gracefully', () => {
    render(<SkipLink targetId="non-existent" />);
    const link = screen.getByText('Skip to main content');

    // Should not throw error
    expect(() => fireEvent.click(link)).not.toThrow();
  });

  it('accepts custom className', () => {
    render(<SkipLink className="custom-class" />);
    const link = screen.getByText('Skip to main content');
    expect(link.className).toContain('custom-class');
  });

  it('is hidden visually by default (sr-only)', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');

    // WCAG 2.4.1: Hidden visually but accessible to screen readers
    expect(link.className).toContain('sr-only');
  });

  it('becomes visible when focused', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');

    // WCAG 2.4.1: Skip link should be visible when focused
    expect(link.className).toContain('focus:not-sr-only');
    expect(link.className).toContain('focus:absolute');
    expect(link.className).toContain('focus:bg-white');
    expect(link.className).toContain('focus:text-gray-900');
  });

  it('meets WCAG minimum touch target size when focused', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');

    // WCAG 2.5.5: Target Size (Minimum 44x44px)
    expect(link.className).toContain('focus:min-h-[44px]');
    expect(link.className).toContain('focus:min-w-[44px]');
  });

  it('has proper focus indicator styles', () => {
    render(<SkipLink />);
    const link = screen.getByText('Skip to main content');

    // WCAG 2.4.7: Focus Visible
    expect(link.className).toContain('focus:ring-2');
    expect(link.className).toContain('focus:ring-primary');
    expect(link.className).toContain('focus:outline-none');
  });
});
