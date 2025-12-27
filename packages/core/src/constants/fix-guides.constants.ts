/**
 * Fix Guides Constants
 *
 * Curated remediation guides for common axe-core accessibility violations.
 * Each guide provides practical, actionable steps to fix specific issues.
 */

export interface FixGuide {
  /** Axe-core rule ID */
  ruleId: string;
  /** Brief summary of the issue */
  summary: string;
  /** Code example showing before and after fix */
  codeExample: {
    before: string;
    after: string;
  };
  /** Step-by-step remediation instructions */
  steps: string[];
  /** Link to relevant WCAG documentation */
  wcagLink: string;
}

/**
 * Fix guides for the top 15 most common axe-core rules
 */
export const FIX_GUIDES: Record<string, FixGuide> = {
  'color-contrast': {
    ruleId: 'color-contrast',
    summary: 'Text must have sufficient color contrast against its background (minimum 4.5:1 for normal text, 3:1 for large text)',
    codeExample: {
      before: '<p style="color: #777; background: #fff;">Low contrast text</p>',
      after: '<p style="color: #595959; background: #fff;">Good contrast text (4.54:1)</p>'
    },
    steps: [
      'Use a color contrast checker tool to verify the current contrast ratio',
      'For normal text (< 18pt or < 14pt bold), ensure a contrast ratio of at least 4.5:1',
      'For large text (≥ 18pt or ≥ 14pt bold), ensure a contrast ratio of at least 3:1',
      'Adjust the foreground or background color until the minimum ratio is met',
      'Test with actual users who have low vision or color blindness'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'
  },

  'image-alt': {
    ruleId: 'image-alt',
    summary: 'All <img> elements must have an alt attribute that describes the image content or function',
    codeExample: {
      before: '<img src="logo.png">',
      after: '<img src="logo.png" alt="Company Name - Home">'
    },
    steps: [
      'Add an alt attribute to every <img> element',
      'For informative images, describe the content or function (e.g., "Submit form")',
      'For decorative images, use an empty alt attribute (alt="")',
      'For complex images (charts, diagrams), provide a longer description via aria-describedby or a visible caption',
      'Avoid redundant phrases like "image of" or "picture of"'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html'
  },

  'link-name': {
    ruleId: 'link-name',
    summary: 'Links must have discernible text that describes their purpose or destination',
    codeExample: {
      before: '<a href="/products">Click here</a>',
      after: '<a href="/products">View our products</a>'
    },
    steps: [
      'Ensure every <a> element has visible text content or an aria-label',
      'Use descriptive link text that makes sense out of context (avoid "click here", "read more")',
      'For icon-only links, add aria-label or sr-only text',
      'If using images as links, ensure the image has appropriate alt text',
      'Make link purpose clear from the link text alone, or from the link text with surrounding context'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html'
  },

  'button-name': {
    ruleId: 'button-name',
    summary: 'Buttons must have discernible text that describes their function',
    codeExample: {
      before: '<button><i class="icon-save"></i></button>',
      after: '<button><i class="icon-save"></i><span class="sr-only">Save</span></button>'
    },
    steps: [
      'Ensure every <button> has visible text content or an aria-label',
      'For icon-only buttons, add aria-label or visually hidden text',
      'Use clear, action-oriented text (e.g., "Save document", not just "OK")',
      'If using an <input type="button">, provide a value attribute',
      'If using role="button" on other elements, ensure accessible name via aria-label or text content'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html'
  },

  'html-has-lang': {
    ruleId: 'html-has-lang',
    summary: 'The <html> element must have a lang attribute to specify the page language',
    codeExample: {
      before: '<html>',
      after: '<html lang="en">'
    },
    steps: [
      'Add a lang attribute to the <html> element',
      'Use a valid BCP 47 language code (e.g., "en" for English, "es" for Spanish, "fr" for French)',
      'For regional variations, use subtags (e.g., "en-US" for US English, "en-GB" for British English)',
      'Ensure the lang value matches the primary language of the page content',
      'For content in different languages, use lang attributes on specific elements as needed'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html'
  },

  'label': {
    ruleId: 'label',
    summary: 'Form inputs must have associated labels that describe their purpose',
    codeExample: {
      before: '<input type="text" name="email">',
      after: '<label for="email">Email Address</label>\n<input type="text" id="email" name="email">'
    },
    steps: [
      'Add a <label> element for each form input',
      'Associate the label using the for attribute matching the input\'s id',
      'Alternatively, wrap the input inside the label element',
      'For complex inputs, use aria-labelledby or aria-label as a fallback',
      'Ensure labels are visible and descriptive (avoid placeholder-only forms)',
      'For required fields, indicate this visually and programmatically'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html'
  },

  'document-title': {
    ruleId: 'document-title',
    summary: 'Pages must have a descriptive and meaningful <title> element',
    codeExample: {
      before: '<title>Page</title>',
      after: '<title>Contact Us - Company Name</title>'
    },
    steps: [
      'Add a <title> element in the <head> section if missing',
      'Use descriptive text that identifies the page content or purpose',
      'Follow a consistent format (e.g., "Page Name - Site Name")',
      'Keep titles concise but informative (typically 50-60 characters)',
      'Update the title dynamically for single-page applications when content changes',
      'Ensure the title is unique for each page in multi-page sites'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/page-titled.html'
  },

  'heading-order': {
    ruleId: 'heading-order',
    summary: 'Heading levels should not be skipped (e.g., h1 → h3 without h2)',
    codeExample: {
      before: '<h1>Title</h1>\n<h3>Subsection</h3>',
      after: '<h1>Title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>'
    },
    steps: [
      'Review the heading structure of your page',
      'Ensure headings follow a logical hierarchy (h1 → h2 → h3, etc.)',
      'Do not skip heading levels (e.g., don\'t jump from h2 to h4)',
      'Use only one h1 per page (typically for the main title)',
      'Use headings for structure, not for visual styling (use CSS for appearance)',
      'Verify heading order with a browser extension or accessibility checker'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
  },

  'list': {
    ruleId: 'list',
    summary: 'List elements (<ul>, <ol>) must only contain <li> elements as direct children',
    codeExample: {
      before: '<ul>\n  <div>Item 1</div>\n  <li>Item 2</li>\n</ul>',
      after: '<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>'
    },
    steps: [
      'Ensure <ul> and <ol> elements only contain <li> elements as direct children',
      'Remove or wrap invalid child elements (like <div>, <p>, text nodes)',
      'Use <ul> for unordered lists (bullet points)',
      'Use <ol> for ordered lists (numbered items)',
      'For complex list items, nest the additional content inside the <li> element'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
  },

  'aria-allowed-attr': {
    ruleId: 'aria-allowed-attr',
    summary: 'ARIA attributes must be valid for the element or role they are used on',
    codeExample: {
      before: '<div role="button" aria-placeholder="Click me">Click</div>',
      after: '<button aria-label="Click me">Click</button>'
    },
    steps: [
      'Review ARIA attributes on each element',
      'Remove ARIA attributes that are not allowed for the element\'s role',
      'Check the WAI-ARIA specification for allowed attributes per role',
      'Prefer native HTML elements over ARIA when possible (e.g., <button> instead of <div role="button">)',
      'Validate ARIA usage with automated tools and screen reader testing'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html'
  },

  'aria-required-attr': {
    ruleId: 'aria-required-attr',
    summary: 'Elements with ARIA roles must have all required ARIA attributes',
    codeExample: {
      before: '<div role="checkbox">Accept terms</div>',
      after: '<div role="checkbox" aria-checked="false" tabindex="0">Accept terms</div>'
    },
    steps: [
      'Identify elements with explicit ARIA roles',
      'Check the WAI-ARIA specification for required attributes for each role',
      'Add missing required attributes with appropriate values',
      'For interactive roles, ensure tabindex is set to make the element focusable',
      'Consider using native HTML elements instead of ARIA roles when possible'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html'
  },

  'duplicate-id': {
    ruleId: 'duplicate-id',
    summary: 'ID attributes must be unique across the entire page',
    codeExample: {
      before: '<div id="content">...</div>\n<div id="content">...</div>',
      after: '<div id="main-content">...</div>\n<div id="sidebar-content">...</div>'
    },
    steps: [
      'Identify all elements with duplicate ID values',
      'Rename IDs to be unique across the page',
      'Update any references to changed IDs (e.g., label[for], aria-labelledby, CSS selectors)',
      'For dynamically generated content, ensure ID generation produces unique values',
      'Use classes instead of IDs for styling purposes when multiple elements share styles'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/parsing.html'
  },

  'frame-title': {
    ruleId: 'frame-title',
    summary: 'Frames and iframes must have a title attribute describing their content',
    codeExample: {
      before: '<iframe src="map.html"></iframe>',
      after: '<iframe src="map.html" title="Interactive store location map"></iframe>'
    },
    steps: [
      'Add a title attribute to every <iframe> and <frame> element',
      'Use descriptive text that explains the frame\'s content or purpose',
      'Make titles unique if multiple frames exist on the page',
      'Keep titles concise but informative',
      'For hidden frames, still provide a title (e.g., "Third-party tracking frame")'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html'
  },

  'bypass': {
    ruleId: 'bypass',
    summary: 'Pages must have a mechanism to skip repeated navigation and jump to main content',
    codeExample: {
      before: '<body>\n  <nav>...</nav>\n  <main>...</main>\n</body>',
      after: '<body>\n  <a href="#main-content" class="skip-link">Skip to main content</a>\n  <nav>...</nav>\n  <main id="main-content">...</main>\n</body>'
    },
    steps: [
      'Add a "skip to main content" link at the top of the page',
      'Make the link the first focusable element on the page',
      'Link to the main content area using a fragment identifier (#main-content)',
      'Style the link to be visible on focus (even if visually hidden by default)',
      'Alternatively, use ARIA landmarks (e.g., <main>, <nav>) for screen reader navigation',
      'Test with keyboard navigation to ensure the skip link works'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html'
  },

  'meta-viewport': {
    ruleId: 'meta-viewport',
    summary: 'Viewport meta tag must not prevent user scaling/zooming',
    codeExample: {
      before: '<meta name="viewport" content="width=device-width, user-scalable=no">',
      after: '<meta name="viewport" content="width=device-width, initial-scale=1">'
    },
    steps: [
      'Locate the viewport meta tag in the <head> section',
      'Remove user-scalable=no and maximum-scale restrictions',
      'Allow users to zoom up to at least 200%',
      'Use responsive design instead of preventing zoom',
      'Test on mobile devices to ensure content remains usable when zoomed',
      'Recommended value: <meta name="viewport" content="width=device-width, initial-scale=1">'
    ],
    wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html'
  }
};

/**
 * Get all available fix guide rule IDs
 */
export function getFixGuideRuleIds(): string[] {
  return Object.keys(FIX_GUIDES);
}

/**
 * Check if a fix guide exists for a given rule ID
 */
export function hasFixGuide(ruleId: string): boolean {
  return ruleId in FIX_GUIDES;
}
