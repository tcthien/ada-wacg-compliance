'use client';

import { useState } from 'react';
import { IssueCard } from './IssueCard';

export interface Issue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

interface IssueListProps {
  issues: Issue[];
}

type FilterType = 'critical' | 'serious' | 'moderate' | 'minor' | null;

export function IssueList({ issues }: IssueListProps) {
  const [filter, setFilter] = useState<FilterType>(null);

  const filteredIssues = filter
    ? issues.filter((i) => i.impact === filter)
    : issues;

  return (
    <div>
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterButton active={!filter} onClick={() => setFilter(null)}>
          All ({issues.length})
        </FilterButton>
        <FilterButton
          active={filter === 'critical'}
          onClick={() => setFilter('critical')}
        >
          Critical ({issues.filter((i) => i.impact === 'critical').length})
        </FilterButton>
        <FilterButton
          active={filter === 'serious'}
          onClick={() => setFilter('serious')}
        >
          Serious ({issues.filter((i) => i.impact === 'serious').length})
        </FilterButton>
        <FilterButton
          active={filter === 'moderate'}
          onClick={() => setFilter('moderate')}
        >
          Moderate ({issues.filter((i) => i.impact === 'moderate').length})
        </FilterButton>
        <FilterButton
          active={filter === 'minor'}
          onClick={() => setFilter('minor')}
        >
          Minor ({issues.filter((i) => i.impact === 'minor').length})
        </FilterButton>
      </div>

      {/* Issue cards */}
      <div className="space-y-4">
        {filteredIssues.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No issues found in this category.
          </p>
        ) : (
          filteredIssues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))
        )}
      </div>
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      }`}
    >
      {children}
    </button>
  );
}
