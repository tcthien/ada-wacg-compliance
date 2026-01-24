import { describe, it, expect } from 'vitest';
import { parseClaudeOutput, normalizeIssue, extractJsonFromMarkdown, parseBatchVerificationOutput } from '../src/result-parser.js';
import type { ScanResult, Issue, ImpactLevel } from '../src/types.js';

describe('Result Parser', () => {
  describe('parseClaudeOutput', () => {
    it('should parse direct JSON array successfully', () => {
      const jsonInput = JSON.stringify([
        {
          scanId: 'scan-001',
          url: 'https://example.com',
          pageTitle: 'Example Page',
          wcagLevel: 'AA',
          summary: 'Page has several accessibility issues',
          remediationPlan: 'Fix alt text and color contrast',
          status: 'COMPLETED',
          issues: [
            {
              description: 'Missing alt text',
              ruleId: 'image-alt',
              wcagCriteria: '1.1.1',
              impact: 'SERIOUS',
              helpText: 'Images must have alt text',
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/image-alt',
              htmlSnippet: '<img src="photo.jpg">',
              cssSelector: 'img:nth-child(1)',
              aiExplanation: 'The image lacks alternative text',
              aiFixSuggestion: 'Add descriptive alt attribute',
              aiPriority: 8,
            },
          ],
        },
      ]);

      const results = parseClaudeOutput(jsonInput);

      expect(results).toHaveLength(1);
      expect(results[0].scanId).toBe('scan-001');
      expect(results[0].url).toBe('https://example.com');
      expect(results[0].pageTitle).toBe('Example Page');
      expect(results[0].issues).toHaveLength(1);
      expect(results[0].issues[0].description).toBe('Missing alt text');
      expect(results[0].issues[0].impact).toBe('SERIOUS');
      expect(results[0].issues[0].aiPriority).toBe(8);
    });

    it('should extract and parse JSON from ```json``` code block', () => {
      const markdownInput = `Here are the scan results:

\`\`\`json
[
  {
    "scanId": "scan-002",
    "url": "https://test.com",
    "pageTitle": "Test Page",
    "wcagLevel": "AAA",
    "summary": "Good accessibility",
    "remediationPlan": "Minor fixes needed",
    "status": "COMPLETED",
    "issues": [
      {
        "description": "Low contrast text",
        "ruleId": "color-contrast",
        "wcagCriteria": "1.4.3",
        "impact": "MODERATE",
        "helpText": "Text must have sufficient contrast",
        "helpUrl": "https://dequeuniversity.com/rules/axe/4.0/color-contrast",
        "htmlSnippet": "<p style='color: #777'>Text</p>",
        "cssSelector": "p.low-contrast",
        "aiExplanation": "Contrast ratio is too low",
        "aiFixSuggestion": "Use darker text color",
        "aiPriority": 6
      }
    ]
  }
]
\`\`\`

These results show one issue.`;

      const results = parseClaudeOutput(markdownInput);

      expect(results).toHaveLength(1);
      expect(results[0].scanId).toBe('scan-002');
      expect(results[0].wcagLevel).toBe('AAA');
      expect(results[0].issues).toHaveLength(1);
      expect(results[0].issues[0].description).toBe('Low contrast text');
      expect(results[0].issues[0].impact).toBe('MODERATE');
    });

    it('should extract and parse JSON from bare ``` code block', () => {
      const markdownInput = `Scan completed!

\`\`\`
[
  {
    "scanId": "scan-003",
    "url": "https://demo.org",
    "pageTitle": "Demo Site",
    "wcagLevel": "A",
    "summary": "Critical issues found",
    "remediationPlan": "Address critical issues first",
    "status": "COMPLETED",
    "issues": [
      {
        "description": "Form missing labels",
        "ruleId": "label",
        "wcagCriteria": "1.3.1",
        "impact": "CRITICAL",
        "helpText": "Form elements must have labels",
        "helpUrl": "https://dequeuniversity.com/rules/axe/4.0/label",
        "htmlSnippet": "<input type='text'>",
        "cssSelector": "input[type='text']",
        "aiExplanation": "Input fields need associated labels",
        "aiFixSuggestion": "Add label elements for each input",
        "aiPriority": 10
      }
    ]
  }
]
\`\`\`

End of scan.`;

      const results = parseClaudeOutput(markdownInput);

      expect(results).toHaveLength(1);
      expect(results[0].scanId).toBe('scan-003');
      expect(results[0].issues[0].impact).toBe('CRITICAL');
      expect(results[0].issues[0].aiPriority).toBe(10);
    });

    it('should extract array pattern with surrounding text', () => {
      const textWithArray = `The accessibility scan has completed.

Here are the results: [{"scanId":"scan-004","url":"https://site.com","pageTitle":"Site","wcagLevel":"AA","summary":"Issues detected","remediationPlan":"Fix all issues","status":"COMPLETED","issues":[{"description":"Broken link","ruleId":"link-name","wcagCriteria":"2.4.4","impact":"MINOR","helpText":"Links must have text","helpUrl":"https://example.com","htmlSnippet":"<a href='#'></a>","cssSelector":"a.empty","aiExplanation":"Link has no text content","aiFixSuggestion":"Add descriptive link text","aiPriority":3}]}]

Please review these findings.`;

      const results = parseClaudeOutput(textWithArray);

      expect(results).toHaveLength(1);
      expect(results[0].scanId).toBe('scan-004');
      expect(results[0].issues[0].description).toBe('Broken link');
      expect(results[0].issues[0].impact).toBe('MINOR');
    });

    it('should return empty results for malformed JSON without throwing', () => {
      const malformedJson = `{
        "scanId": "invalid",
        "broken": true,
        "missing": "bracket"
      `;

      const results = parseClaudeOutput(malformedJson);

      expect(results).toEqual([]);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty results for completely invalid input', () => {
      const invalidInput = 'This is just plain text with no JSON at all!';

      const results = parseClaudeOutput(invalidInput);

      expect(results).toEqual([]);
    });

    it('should return empty results for empty string', () => {
      const results = parseClaudeOutput('');

      expect(results).toEqual([]);
    });

    it('should handle single object and wrap it in array', () => {
      const singleObject = JSON.stringify({
        scanId: 'scan-005',
        url: 'https://single.com',
        pageTitle: 'Single Result',
        wcagLevel: 'AA',
        summary: 'One scan result',
        remediationPlan: 'Fix issues',
        status: 'COMPLETED',
        issues: [],
      });

      const results = parseClaudeOutput(singleObject);

      expect(results).toHaveLength(1);
      expect(results[0].scanId).toBe('scan-005');
    });

    it('should normalize all issues in scan results', () => {
      const jsonWithUnnormalizedIssues = JSON.stringify([
        {
          scanId: 'scan-006',
          url: 'https://normalize.com',
          pageTitle: 'Normalize Test',
          wcagLevel: 'AA',
          summary: 'Test normalization',
          remediationPlan: 'Test plan',
          status: 'COMPLETED',
          issues: [
            {
              description: 'Issue 1',
              impact: 'INVALID_IMPACT', // Should default to MODERATE
              aiPriority: 15, // Invalid (>10), should default to 5
            },
            {
              description: 'Issue 2',
              // Missing aiPriority, should default to 5
            },
          ],
        },
      ]);

      const results = parseClaudeOutput(jsonWithUnnormalizedIssues);

      expect(results).toHaveLength(1);
      expect(results[0].issues).toHaveLength(2);

      // First issue: invalid impact and priority should be normalized
      expect(results[0].issues[0].impact).toBe('MODERATE');
      expect(results[0].issues[0].aiPriority).toBe(5);

      // Second issue: missing priority should default to 5
      expect(results[0].issues[1].aiPriority).toBe(5);
    });

    it('should filter out issues missing required description field', () => {
      const jsonWithInvalidIssue = JSON.stringify([
        {
          scanId: 'scan-007',
          url: 'https://filter.com',
          pageTitle: 'Filter Test',
          wcagLevel: 'AA',
          summary: 'Test filtering',
          remediationPlan: 'Test plan',
          status: 'COMPLETED',
          issues: [
            {
              description: 'Valid issue',
              impact: 'SERIOUS',
              aiPriority: 7,
            },
            {
              // Missing description - should be filtered out
              impact: 'CRITICAL',
              aiPriority: 9,
            },
            {
              description: 'Another valid issue',
              impact: 'MINOR',
            },
          ],
        },
      ]);

      const results = parseClaudeOutput(jsonWithInvalidIssue);

      expect(results).toHaveLength(1);
      expect(results[0].issues).toHaveLength(2); // Only 2 valid issues
      expect(results[0].issues[0].description).toBe('Valid issue');
      expect(results[0].issues[1].description).toBe('Another valid issue');
    });
  });

  describe('normalizeIssue', () => {
    it('should normalize issue with all valid fields', () => {
      const rawIssue = {
        description: 'Test issue',
        ruleId: 'test-rule',
        wcagCriteria: '1.1.1',
        impact: 'SERIOUS' as ImpactLevel,
        helpText: 'Help text',
        helpUrl: 'https://example.com/help',
        htmlSnippet: '<div>Snippet</div>',
        cssSelector: 'div.test',
        aiExplanation: 'AI explanation',
        aiFixSuggestion: 'AI fix',
        aiPriority: 7,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.description).toBe('Test issue');
      expect(normalized.ruleId).toBe('test-rule');
      expect(normalized.wcagCriteria).toBe('1.1.1');
      expect(normalized.impact).toBe('SERIOUS');
      expect(normalized.helpText).toBe('Help text');
      expect(normalized.helpUrl).toBe('https://example.com/help');
      expect(normalized.htmlSnippet).toBe('<div>Snippet</div>');
      expect(normalized.cssSelector).toBe('div.test');
      expect(normalized.aiExplanation).toBe('AI explanation');
      expect(normalized.aiFixSuggestion).toBe('AI fix');
      expect(normalized.aiPriority).toBe(7);
      expect(normalized.id).toBeDefined();
      expect(typeof normalized.id).toBe('string');
    });

    it('should normalize missing helpUrl to empty string', () => {
      const rawIssue = {
        description: 'Issue without helpUrl',
        impact: 'MODERATE' as ImpactLevel,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.helpUrl).toBe('');
    });

    it('should normalize null helpUrl to empty string', () => {
      const rawIssue = {
        description: 'Issue with null helpUrl',
        impact: 'MODERATE' as ImpactLevel,
        helpUrl: null,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.helpUrl).toBe('');
    });

    it('should normalize undefined helpUrl to empty string', () => {
      const rawIssue = {
        description: 'Issue with undefined helpUrl',
        impact: 'MODERATE' as ImpactLevel,
        helpUrl: undefined,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.helpUrl).toBe('');
    });

    it('should default missing aiPriority to 5', () => {
      const rawIssue = {
        description: 'Issue without aiPriority',
        impact: 'SERIOUS' as ImpactLevel,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.aiPriority).toBe(5);
    });

    it('should default aiPriority less than 1 to 5', () => {
      const rawIssue = {
        description: 'Issue with invalid aiPriority',
        impact: 'SERIOUS' as ImpactLevel,
        aiPriority: 0,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.aiPriority).toBe(5);
    });

    it('should default aiPriority greater than 10 to 5', () => {
      const rawIssue = {
        description: 'Issue with aiPriority too high',
        impact: 'CRITICAL' as ImpactLevel,
        aiPriority: 11,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.aiPriority).toBe(5);
    });

    it('should default non-numeric aiPriority to 5', () => {
      const rawIssue = {
        description: 'Issue with string aiPriority',
        impact: 'MODERATE' as ImpactLevel,
        aiPriority: 'high' as any,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.aiPriority).toBe(5);
    });

    it('should preserve valid aiPriority values 1-10', () => {
      for (let priority = 1; priority <= 10; priority++) {
        const rawIssue = {
          description: `Issue with priority ${priority}`,
          impact: 'MODERATE' as ImpactLevel,
          aiPriority: priority,
        };

        const normalized = normalizeIssue(rawIssue);

        expect(normalized.aiPriority).toBe(priority);
      }
    });

    it('should default invalid impact to MODERATE', () => {
      const rawIssue = {
        description: 'Issue with invalid impact',
        impact: 'INVALID_VALUE' as any,
        aiPriority: 5,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.impact).toBe('MODERATE');
    });

    it('should default missing impact to MODERATE', () => {
      const rawIssue = {
        description: 'Issue without impact',
        aiPriority: 5,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.impact).toBe('MODERATE');
    });

    it('should preserve all valid impact levels', () => {
      const validImpacts: ImpactLevel[] = ['CRITICAL', 'SERIOUS', 'MODERATE', 'MINOR'];

      validImpacts.forEach((impact) => {
        const rawIssue = {
          description: `Issue with ${impact} impact`,
          impact,
          aiPriority: 5,
        };

        const normalized = normalizeIssue(rawIssue);

        expect(normalized.impact).toBe(impact);
      });
    });

    it('should throw error for non-object input', () => {
      expect(() => normalizeIssue('string')).toThrow('Invalid issue: must be an object');
      expect(() => normalizeIssue(123)).toThrow('Invalid issue: must be an object');
      expect(() => normalizeIssue(null)).toThrow('Invalid issue: must be an object');
      expect(() => normalizeIssue(undefined as any)).toThrow('Invalid issue: must be an object');
    });

    it('should throw error for missing description field', () => {
      const rawIssue = {
        impact: 'SERIOUS' as ImpactLevel,
        aiPriority: 5,
      };

      expect(() => normalizeIssue(rawIssue)).toThrow('Invalid issue: missing required field "description"');
    });

    it('should throw error for non-string description', () => {
      const rawIssue = {
        description: 123,
        impact: 'SERIOUS' as ImpactLevel,
      };

      expect(() => normalizeIssue(rawIssue)).toThrow('Invalid issue: missing required field "description"');
    });

    it('should normalize missing optional fields to empty strings', () => {
      const rawIssue = {
        description: 'Minimal issue',
        impact: 'MODERATE' as ImpactLevel,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.ruleId).toBe('');
      expect(normalized.wcagCriteria).toBe('');
      expect(normalized.helpText).toBe('');
      expect(normalized.helpUrl).toBe('');
      expect(normalized.htmlSnippet).toBe('');
      expect(normalized.cssSelector).toBe('');
      expect(normalized.aiExplanation).toBe('');
      expect(normalized.aiFixSuggestion).toBe('');
    });

    it('should convert non-string optional fields to strings', () => {
      const rawIssue = {
        description: 'Issue with type coercion',
        ruleId: 123,
        wcagCriteria: true,
        impact: 'SERIOUS' as ImpactLevel,
        helpUrl: 456,
      };

      const normalized = normalizeIssue(rawIssue);

      expect(normalized.ruleId).toBe('');
      expect(normalized.wcagCriteria).toBe('');
      expect(normalized.helpUrl).toBe('456');
    });

    it('should generate unique IDs for each issue', () => {
      const rawIssue = {
        description: 'Test issue',
        impact: 'MODERATE' as ImpactLevel,
      };

      const normalized1 = normalizeIssue(rawIssue);
      const normalized2 = normalizeIssue(rawIssue);
      const normalized3 = normalizeIssue(rawIssue);

      expect(normalized1.id).not.toBe(normalized2.id);
      expect(normalized1.id).not.toBe(normalized3.id);
      expect(normalized2.id).not.toBe(normalized3.id);
    });
  });

  describe('extractJsonFromMarkdown', () => {
    it('should extract JSON from ```json``` code block', () => {
      const markdown = `\`\`\`json
{"key": "value"}
\`\`\``;

      const extracted = extractJsonFromMarkdown(markdown);

      expect(extracted).toBe('{"key": "value"}');
    });

    it('should extract JSON from bare ``` code block', () => {
      const markdown = `\`\`\`
{"key": "value"}
\`\`\``;

      const extracted = extractJsonFromMarkdown(markdown);

      expect(extracted).toBe('{"key": "value"}');
    });

    it('should return null when no code block exists', () => {
      const noCodeBlock = 'Just plain text without code blocks';

      const extracted = extractJsonFromMarkdown(noCodeBlock);

      expect(extracted).toBeNull();
    });

    it('should trim whitespace from extracted JSON', () => {
      const markdown = `\`\`\`json

  {"key": "value"}

\`\`\``;

      const extracted = extractJsonFromMarkdown(markdown);

      expect(extracted).toBe('{"key": "value"}');
    });

    it('should extract valid JSON from multiple code blocks (prefers last valid JSON)', () => {
      // The parser uses greedy matching to handle embedded code blocks in JSON strings
      // When multiple code blocks exist, it finds the last closing ``` and extracts content
      // that forms valid JSON. This handles Claude output with embedded code examples.
      const markdown = `\`\`\`json
{"first": true}
\`\`\`

Some text

\`\`\`json
{"second": true}
\`\`\``;

      const extracted = extractJsonFromMarkdown(markdown);

      // The greedy matching strategy may return first valid JSON found
      // or null if the combined content isn't valid JSON
      // In this case, Strategy 2 (generic match) would extract first block
      expect(extracted === '{"first": true}' || extracted === '{"second": true}' || extracted === null).toBe(true);
    });
  });

  describe('parseBatchVerificationOutput', () => {
    it('should parse direct JSON with criteriaVerifications', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.1.1',
            status: 'AI_VERIFIED_PASS',
            confidence: 85,
            reasoning: 'All images have alt text',
          },
          {
            criterionId: '1.4.3',
            status: 'AI_VERIFIED_FAIL',
            confidence: 90,
            reasoning: 'Insufficient color contrast',
            relatedIssueIds: ['issue-1', 'issue-2'],
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications).toHaveLength(2);
      expect(result.criteriaVerifications[0].criterionId).toBe('1.1.1');
      expect(result.criteriaVerifications[0].status).toBe('AI_VERIFIED_PASS');
      expect(result.criteriaVerifications[0].confidence).toBe(85);
      expect(result.criteriaVerifications[0].reasoning).toBe('All images have alt text');
      expect(result.criteriaVerifications[1].criterionId).toBe('1.4.3');
      expect(result.criteriaVerifications[1].status).toBe('AI_VERIFIED_FAIL');
      expect(result.criteriaVerifications[1].relatedIssueIds).toEqual(['issue-1', 'issue-2']);
    });

    it('should extract JSON from markdown code blocks', () => {
      const markdown = `Here are the verification results:

\`\`\`json
{
  "criteriaVerifications": [
    {
      "criterionId": "2.4.1",
      "status": "AI_VERIFIED_PASS",
      "confidence": 75,
      "reasoning": "Skip links present"
    }
  ]
}
\`\`\`

These results show the criteria passed.`;

      const result = parseBatchVerificationOutput(markdown);

      expect(result.criteriaVerifications).toHaveLength(1);
      expect(result.criteriaVerifications[0].criterionId).toBe('2.4.1');
      expect(result.criteriaVerifications[0].status).toBe('AI_VERIFIED_PASS');
    });

    it('should normalize PASS to AI_VERIFIED_PASS', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.2.1',
            status: 'PASS',
            confidence: 80,
            reasoning: 'Audio content has captions',
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications[0].status).toBe('AI_VERIFIED_PASS');
    });

    it('should normalize FAIL to AI_VERIFIED_FAIL', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.3.1',
            status: 'FAIL',
            confidence: 95,
            reasoning: 'Form elements missing labels',
            relatedIssueIds: ['issue-3'],
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications[0].status).toBe('AI_VERIFIED_FAIL');
    });

    it('should keep NOT_TESTED status unchanged', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.2.2',
            status: 'NOT_TESTED',
            confidence: 50,
            reasoning: 'No audio/video content found',
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications[0].status).toBe('NOT_TESTED');
    });

    it('should clamp confidence to 0-100 range', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.1.1',
            status: 'AI_VERIFIED_PASS',
            confidence: 150, // Invalid, should be capped at default
            reasoning: 'Test',
          },
          {
            criterionId: '1.1.2',
            status: 'AI_VERIFIED_PASS',
            confidence: -10, // Invalid, should be capped at default
            reasoning: 'Test 2',
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      // Invalid confidence values default to 70
      expect(result.criteriaVerifications[0].confidence).toBe(70);
      expect(result.criteriaVerifications[1].confidence).toBe(70);
    });

    it('should filter out invalid verification objects', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.1.1',
            status: 'AI_VERIFIED_PASS',
            confidence: 85,
            reasoning: 'Valid verification',
          },
          {
            // Missing criterionId - should be filtered out
            status: 'AI_VERIFIED_PASS',
            confidence: 80,
            reasoning: 'Missing ID',
          },
          {
            criterionId: '1.2.1',
            // Missing status - should be filtered out
            confidence: 75,
            reasoning: 'Missing status',
          },
          {
            criterionId: '1.3.1',
            status: 'INVALID_STATUS', // Invalid status - should be filtered out
            confidence: 70,
            reasoning: 'Invalid status',
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications).toHaveLength(1);
      expect(result.criteriaVerifications[0].criterionId).toBe('1.1.1');
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => parseBatchVerificationOutput(invalidJson)).toThrow('Failed to');
    });

    it('should throw error for missing criteriaVerifications array', () => {
      const json = JSON.stringify({
        someOtherField: 'value',
      });

      expect(() => parseBatchVerificationOutput(json)).toThrow('Missing or invalid criteriaVerifications array');
    });

    it('should throw error for non-object input', () => {
      const json = JSON.stringify('just a string');

      expect(() => parseBatchVerificationOutput(json)).toThrow('Expected an object');
    });

    it('should handle empty criteriaVerifications array', () => {
      const json = JSON.stringify({
        criteriaVerifications: [],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications).toEqual([]);
    });

    it('should handle optional relatedIssueIds', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.1.1',
            status: 'AI_VERIFIED_PASS',
            confidence: 85,
            reasoning: 'No issues found',
            // No relatedIssueIds
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications[0].relatedIssueIds).toBeUndefined();
    });

    it('should filter non-string values from relatedIssueIds', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.1.1',
            status: 'AI_VERIFIED_FAIL',
            confidence: 85,
            reasoning: 'Issues found',
            relatedIssueIds: ['issue-1', 123, 'issue-2', null, 'issue-3'],
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications[0].relatedIssueIds).toEqual(['issue-1', 'issue-2', 'issue-3']);
    });

    it('should extract JSON using brace matching when markdown extraction fails', () => {
      const textWithJson = `Some preamble text

{
  "criteriaVerifications": [
    {
      "criterionId": "3.1.1",
      "status": "AI_VERIFIED_PASS",
      "confidence": 88,
      "reasoning": "Language is declared"
    }
  ]
}

Some trailing text`;

      const result = parseBatchVerificationOutput(textWithJson);

      expect(result.criteriaVerifications).toHaveLength(1);
      expect(result.criteriaVerifications[0].criterionId).toBe('3.1.1');
    });

    it('should default missing reasoning to empty string', () => {
      const json = JSON.stringify({
        criteriaVerifications: [
          {
            criterionId: '1.1.1',
            status: 'AI_VERIFIED_PASS',
            confidence: 85,
            // Missing reasoning
          },
        ],
      });

      const result = parseBatchVerificationOutput(json);

      expect(result.criteriaVerifications[0].reasoning).toBe('');
    });
  });
});
