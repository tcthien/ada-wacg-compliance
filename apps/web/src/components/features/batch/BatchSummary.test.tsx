import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatchSummary } from './BatchSummary';
import type { BatchResultsResponse } from '@/lib/batch-api';

describe('BatchSummary', () => {
  const mockResults: BatchResultsResponse = {
    batchId: 'batch_123',
    status: 'COMPLETED',
    homepageUrl: 'https://example.com',
    wcagLevel: 'AA',
    totalUrls: 10,
    completedCount: 10,
    failedCount: 0,
    createdAt: '2025-12-29T12:00:00.000Z',
    completedAt: '2025-12-29T12:30:00.000Z',
    aggregate: {
      totalIssues: 125,
      criticalCount: 15,
      seriousCount: 35,
      moderateCount: 50,
      minorCount: 25,
      passedChecks: 450,
      urlsScanned: 10,
    },
    urls: [
      {
        id: 'scan_1',
        url: 'https://example.com/page1',
        status: 'COMPLETED',
        pageTitle: 'Page 1',
        totalIssues: 30,
        criticalCount: 8,
        seriousCount: 10,
        moderateCount: 8,
        minorCount: 4,
        errorMessage: null,
      },
      {
        id: 'scan_2',
        url: 'https://example.com/page2',
        status: 'COMPLETED',
        pageTitle: 'Page 2',
        totalIssues: 25,
        criticalCount: 7,
        seriousCount: 8,
        moderateCount: 7,
        minorCount: 3,
        errorMessage: null,
      },
    ],
    topCriticalUrls: [
      {
        url: 'https://example.com/page1',
        pageTitle: 'Page 1',
        criticalCount: 8,
      },
      {
        url: 'https://example.com/page2',
        pageTitle: 'Page 2',
        criticalCount: 7,
      },
    ],
  };

  it('renders aggregate statistics', () => {
    render(<BatchSummary results={mockResults} />);

    // Check severity counts
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('Serious')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
    expect(screen.getByText('450')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('displays total issues and URLs scanned', () => {
    render(<BatchSummary results={mockResults} />);

    expect(screen.getByText(/125/)).toBeInTheDocument();
    expect(screen.getByText(/total issues/i)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
    expect(screen.getByText(/URLs scanned/i)).toBeInTheDocument();
  });

  it('displays top critical URLs with rankings', () => {
    render(<BatchSummary results={mockResults} />);

    expect(screen.getByText('Top URLs with Critical Issues')).toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByText('8 critical')).toBeInTheDocument();
    expect(screen.getByText('7 critical')).toBeInTheDocument();

    // Check rank badges
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows success message when no critical issues', () => {
    const noCriticalResults: BatchResultsResponse = {
      ...mockResults,
      aggregate: {
        ...mockResults.aggregate,
        criticalCount: 0,
      },
      topCriticalUrls: [],
    };

    render(<BatchSummary results={noCriticalResults} />);

    expect(screen.getByText('No critical issues found!')).toBeInTheDocument();
  });

  it('applies correct color classes to severity cards', () => {
    const { container } = render(<BatchSummary results={mockResults} />);

    // Check for color classes
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards[0]).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200'); // Critical
    expect(cards[1]).toHaveClass('bg-orange-100', 'text-orange-800', 'border-orange-200'); // Serious
    expect(cards[2]).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200'); // Moderate
    expect(cards[3]).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200'); // Minor
    expect(cards[4]).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200'); // Passed
  });

  it('truncates long URLs with title attribute', () => {
    render(<BatchSummary results={mockResults} />);

    const urlElements = screen.getAllByTitle(/https:\/\/example.com/);
    expect(urlElements.length).toBeGreaterThan(0);
    urlElements.forEach((el) => {
      expect(el).toHaveClass('truncate');
    });
  });
});
