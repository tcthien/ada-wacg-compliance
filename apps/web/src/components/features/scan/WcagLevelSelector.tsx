'use client';

/**
 * WCAG Level Selector Component
 * Enhanced UI component for selecting WCAG conformance level
 * Features:
 * - Radio group with A, AA, AAA options
 * - Info icon with tooltip for each level
 * - Expandable "Learn more" section with detailed explanations
 * - Accessibility-compliant with ARIA attributes
 */

import * as React from 'react';
import { Info, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface WcagLevelSelectorProps {
  value: 'A' | 'AA' | 'AAA';
  onChange: (level: 'A' | 'AA' | 'AAA') => void;
  showHelp?: boolean;
  disabled?: boolean;
}

const WCAG_LEVEL_INFO = {
  A: {
    title: 'Level A - Essential',
    shortTitle: 'Essential',
    description: 'Basic accessibility requirements. Minimum compliance.',
    shortDescription: 'Minimum compliance',
    examples: ['Alt text for images', 'Keyboard navigation', 'Form labels'],
    legalNote: 'May not satisfy most legal requirements alone.',
  },
  AA: {
    title: 'Level AA - Standard',
    shortTitle: 'Standard',
    description: 'Enhanced accessibility. Most common legal requirement.',
    shortDescription: 'Most common requirement',
    examples: ['Color contrast 4.5:1', 'Resize text 200%', 'Focus visible'],
    legalNote: 'Required by ADA, EAA, Section 508.',
    recommended: true,
  },
  AAA: {
    title: 'Level AAA - Enhanced',
    shortTitle: 'Enhanced',
    description: 'Highest accessibility standard. Exceeds most requirements.',
    shortDescription: 'Highest standard',
    examples: ['Color contrast 7:1', 'Sign language', 'Reading level'],
    legalNote: 'Recommended for specialized audiences.',
  },
} as const;

export function WcagLevelSelector({
  value,
  onChange,
  showHelp = true,
  disabled = false,
}: WcagLevelSelectorProps) {
  const [expandedLevel, setExpandedLevel] = React.useState<string | undefined>(undefined);

  const levels = (['A', 'AA', 'AAA'] as const);

  return (
    <div className="space-y-4">
      <fieldset disabled={disabled}>
        <legend className="block text-sm font-medium text-foreground mb-3">
          WCAG Conformance Level
        </legend>

        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup">
            {levels.map((level) => {
              const info = WCAG_LEVEL_INFO[level];
              const isSelected = value === level;
              const isRecommended = 'recommended' in info && info.recommended;

              return (
                <div key={level} className="relative">
                  <label
                    className={cn(
                      'flex flex-col cursor-pointer h-full',
                      'px-4 py-3 rounded-lg border transition-all',
                      'hover:shadow-sm',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-500 ring-opacity-20'
                        : 'border-gray-300 bg-white hover:border-gray-400',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {/* Header Row: Radio + Level Badge + Info Icon */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {/* Radio Input */}
                        <input
                          type="radio"
                          name="wcagLevel"
                          value={level}
                          checked={isSelected}
                          onChange={() => onChange(level)}
                          className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          disabled={disabled}
                          aria-describedby={`wcag-${level}-description`}
                        />
                        {/* Level Badge */}
                        <span
                          className={cn(
                            'font-bold text-lg',
                            isSelected ? 'text-blue-700' : 'text-gray-900'
                          )}
                        >
                          {level}
                        </span>
                      </div>

                      {/* Info Icon with Tooltip */}
                      {showHelp && (
                        <Tooltip>
                          <TooltipTrigger
                            asChild
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            <button
                              type="button"
                              className={cn(
                                'p-1 rounded-md transition-colors',
                                'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
                                isSelected && 'hover:bg-blue-100'
                              )}
                              aria-label={`More information about ${info.title}`}
                              disabled={disabled}
                            >
                              <Info
                                className={cn(
                                  'w-4 h-4',
                                  isSelected ? 'text-blue-600' : 'text-gray-400'
                                )}
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="center"
                            className="max-w-xs p-3"
                          >
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">{info.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {info.description}
                              </p>
                              <div className="text-xs">
                                <p className="font-medium mb-1">Examples:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                  {info.examples.map((example, idx) => (
                                    <li key={idx}>{example}</li>
                                  ))}
                                </ul>
                              </div>
                              <p className="text-xs italic text-muted-foreground border-t pt-2">
                                {info.legalNote}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Title */}
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-blue-700' : 'text-gray-700'
                      )}
                    >
                      {info.shortTitle}
                    </span>

                    {/* Description */}
                    <p
                      id={`wcag-${level}-description`}
                      className={cn(
                        'text-xs mt-1',
                        isSelected ? 'text-blue-600' : 'text-muted-foreground'
                      )}
                    >
                      {info.shortDescription}
                    </p>

                    {/* Recommended Badge */}
                    {isRecommended && (
                      <span
                        className={cn(
                          'mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit',
                          isSelected
                            ? 'bg-blue-200 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        )}
                      >
                        Recommended
                      </span>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </fieldset>

      {/* Expandable Learn More Section */}
      {showHelp && (
        <Accordion
          type="single"
          collapsible
          {...(expandedLevel !== undefined ? { value: expandedLevel } : {})}
          onValueChange={setExpandedLevel}
        >
          <AccordionItem value="learn-more" className="border-0">
            <AccordionTrigger className="text-sm text-blue-600 hover:text-blue-700 hover:no-underline py-2">
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Learn more about WCAG levels
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-3 pb-2">
              <div className="space-y-4 text-sm">
                {levels.map((level) => {
                  const info = WCAG_LEVEL_INFO[level];
                  return (
                    <div
                      key={level}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <h4 className="font-semibold text-gray-900 mb-2">
                        {info.title}
                      </h4>
                      <p className="text-gray-700 mb-2">{info.description}</p>

                      <div className="mb-2">
                        <p className="font-medium text-gray-800 mb-1">
                          Key Requirements:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                          {info.examples.map((example, idx) => (
                            <li key={idx}>{example}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-gray-300">
                        <p className="text-xs italic text-gray-600">
                          <strong>Legal Note:</strong> {info.legalNote}
                        </p>
                      </div>
                    </div>
                  );
                })}

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Recommendation:</strong> Level AA is the standard
                    requirement for most legal compliance (ADA, EAA, Section 508).
                    Choose Level A only if you understand the limitations, and
                    Level AAA if you serve specialized audiences requiring enhanced
                    accessibility.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
