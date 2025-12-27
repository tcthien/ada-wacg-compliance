'use client';

import { useState } from 'react';
import type { Issue } from './IssueList';
import { IssueCode } from './IssueCode';

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);

  const impactColors = {
    critical: 'border-l-red-500',
    serious: 'border-l-orange-500',
    moderate: 'border-l-yellow-500',
    minor: 'border-l-blue-500',
  };

  const impactBadgeColors = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    serious: 'bg-orange-100 text-orange-800 border-orange-200',
    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    minor: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  // Extract WCAG criteria from tags
  const wcagCriteria = issue.tags.filter((tag) => tag.startsWith('wcag'));

  // Generate fix guide based on issue type
  const fixGuide = generateFixGuide(issue);

  return (
    <div
      className={`border rounded-lg border-l-4 ${impactColors[issue.impact]} bg-card`}
    >
      <button
        className="w-full p-4 text-left flex justify-between items-start hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex-1">
          <div className="flex items-start gap-3 mb-2">
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-medium border ${
                impactBadgeColors[issue.impact]
              }`}
            >
              {issue.impact.toUpperCase()}
            </span>
            <h3 className="font-medium flex-1">{issue.help}</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            {wcagCriteria.length > 0 && (
              <span>WCAG: {wcagCriteria.join(', ')} • </span>
            )}
            {issue.nodes.length} instance{issue.nodes.length !== 1 ? 's' : ''}{' '}
            found
          </div>
        </div>
        <ChevronIcon expanded={expanded} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          <div className="pt-4">
            <p className="text-sm">{issue.description}</p>
          </div>

          {/* Display each node instance */}
          {issue.nodes.map((node, index) => (
            <div key={index} className="space-y-2">
              {issue.nodes.length > 1 && (
                <h4 className="text-sm font-medium">
                  Instance {index + 1} of {issue.nodes.length}
                </h4>
              )}
              <IssueCode
                html={node.html}
                selector={node.target.join(' > ')}
              />
              {node.failureSummary && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  <strong>Issue:</strong> {node.failureSummary}
                </div>
              )}
            </div>
          ))}

          {/* Fix guide */}
          {fixGuide && (
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded border border-green-200 dark:border-green-900">
              <h4 className="font-medium mb-2 text-green-900 dark:text-green-100">
                How to Fix
              </h4>
              <p className="text-sm mb-3 text-green-800 dark:text-green-200">
                {fixGuide.summary}
              </p>
              {fixGuide.steps.length > 0 && (
                <ol className="list-decimal list-inside text-sm space-y-1 text-green-800 dark:text-green-200">
                  {fixGuide.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}
              {fixGuide.codeExample && (
                <div className="mt-3">
                  <p className="text-xs font-medium mb-1 text-green-900 dark:text-green-100">
                    Example:
                  </p>
                  <pre className="p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                    <code>{fixGuide.codeExample}</code>
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Learn more link */}
          <a
            href={issue.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Learn more about this issue
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

interface ChevronIconProps {
  expanded: boolean;
}

function ChevronIcon({ expanded }: ChevronIconProps) {
  return (
    <svg
      className={`w-5 h-5 transition-transform ${
        expanded ? 'transform rotate-180' : ''
      }`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

// Generate contextual fix guides based on issue tags and description
function generateFixGuide(issue: Issue): {
  summary: string;
  steps: string[];
  codeExample?: string;
} | null {
  const tags = issue.tags;
  const help = issue.help.toLowerCase();

  // Image alt text issues
  if (tags.includes('cat.text-alternatives') || help.includes('alt')) {
    return {
      summary: 'Add descriptive alternative text to images for screen readers.',
      steps: [
        'Add an alt attribute to the image element',
        'Describe the content and function of the image',
        'Keep alt text concise (under 150 characters)',
        'Use empty alt="" for decorative images',
      ],
      codeExample: '<img src="logo.png" alt="Company Name logo" />',
    };
  }

  // Form label issues
  if (tags.includes('cat.forms') || help.includes('label')) {
    return {
      summary: 'Associate form inputs with descriptive labels.',
      steps: [
        'Add a <label> element for each input',
        'Use the "for" attribute matching the input\'s "id"',
        'Alternatively, wrap the input inside the label',
        'Ensure label text is descriptive and clear',
      ],
      codeExample:
        '<label for="email">Email Address</label>\n<input type="email" id="email" name="email" />',
    };
  }

  // Color contrast issues
  if (tags.includes('cat.color') || help.includes('contrast')) {
    return {
      summary:
        'Ensure text has sufficient color contrast against its background.',
      steps: [
        'Check contrast ratio using a contrast checker tool',
        'For normal text: use a ratio of at least 4.5:1',
        'For large text (18pt+): use a ratio of at least 3:1',
        'Adjust text or background colors to meet requirements',
      ],
    };
  }

  // Heading structure issues
  if (tags.includes('cat.name-role-value') && help.includes('heading')) {
    return {
      summary: 'Use proper heading hierarchy (h1, h2, h3, etc.).',
      steps: [
        'Start with a single h1 for the main page title',
        'Use h2 for main sections',
        'Use h3 for subsections, and so on',
        'Do not skip heading levels',
      ],
      codeExample:
        '<h1>Page Title</h1>\n<h2>Main Section</h2>\n<h3>Subsection</h3>',
    };
  }

  // Link text issues
  if (tags.includes('cat.name-role-value') && help.includes('link')) {
    return {
      summary: 'Use descriptive link text that makes sense out of context.',
      steps: [
        'Avoid generic text like "click here" or "read more"',
        'Describe the destination or action',
        'Keep link text concise but meaningful',
        'Ensure unique links have unique text',
      ],
      codeExample: '<a href="/contact">Contact our support team</a>',
    };
  }

  // Keyboard accessibility issues
  if (tags.includes('cat.keyboard') || help.includes('keyboard')) {
    return {
      summary: 'Ensure all interactive elements are keyboard accessible.',
      steps: [
        'Use semantic HTML elements (button, a, input)',
        'Add tabindex="0" to custom interactive elements',
        'Implement keyboard event handlers (onKeyDown)',
        'Test navigation using only the Tab and Enter keys',
      ],
    };
  }

  // ARIA issues
  if (tags.includes('cat.aria') || help.includes('aria')) {
    return {
      summary: 'Use ARIA attributes correctly to enhance accessibility.',
      steps: [
        'Prefer semantic HTML over ARIA when possible',
        'Ensure ARIA roles match the element\'s behavior',
        'Provide required ARIA properties for each role',
        'Test with screen readers to verify correct announcement',
      ],
    };
  }

  // Generic fallback
  return {
    summary:
      'Review the issue description and follow WCAG guidelines to resolve.',
    steps: [
      'Read the full issue description above',
      'Click "Learn more" to see detailed WCAG documentation',
      'Implement the recommended fix',
      'Test with accessibility tools and assistive technology',
    ],
  };
}
