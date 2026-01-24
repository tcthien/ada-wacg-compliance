/**
 * WCAG 2.1 Success Criteria Constants
 *
 * Complete mapping of WCAG 2.1 success criteria organized by principle and guideline.
 * Each criterion includes its number, level (A, AA, AAA), title, and description.
 */

export type WCAGLevel = 'A' | 'AA' | 'AAA';

export interface WCAGCriterion {
  /** WCAG criterion number (e.g., "1.1.1") */
  id: string;
  /** Conformance level */
  level: WCAGLevel;
  /** Criterion title */
  title: string;
  /** Brief description of the criterion */
  description: string;
}

/**
 * WCAG 2.1 Success Criteria organized by principle
 */
export const WCAG_CRITERIA: Record<string, WCAGCriterion> = {
  // Principle 1: Perceivable
  // Guideline 1.1: Text Alternatives
  '1.1.1': {
    id: '1.1.1',
    level: 'A',
    title: 'Non-text Content',
    description: 'All non-text content has a text alternative that serves the equivalent purpose'
  },

  // Guideline 1.2: Time-based Media
  '1.2.1': {
    id: '1.2.1',
    level: 'A',
    title: 'Audio-only and Video-only (Prerecorded)',
    description: 'Alternative for time-based media or audio description is provided'
  },
  '1.2.2': {
    id: '1.2.2',
    level: 'A',
    title: 'Captions (Prerecorded)',
    description: 'Captions are provided for prerecorded audio content in synchronized media'
  },
  '1.2.3': {
    id: '1.2.3',
    level: 'A',
    title: 'Audio Description or Media Alternative (Prerecorded)',
    description: 'Audio description or full text alternative is provided for prerecorded video'
  },
  '1.2.4': {
    id: '1.2.4',
    level: 'AA',
    title: 'Captions (Live)',
    description: 'Captions are provided for all live audio content in synchronized media'
  },
  '1.2.5': {
    id: '1.2.5',
    level: 'AA',
    title: 'Audio Description (Prerecorded)',
    description: 'Audio description is provided for all prerecorded video content'
  },
  '1.2.6': {
    id: '1.2.6',
    level: 'AAA',
    title: 'Sign Language (Prerecorded)',
    description: 'Sign language interpretation is provided for prerecorded audio content'
  },
  '1.2.7': {
    id: '1.2.7',
    level: 'AAA',
    title: 'Extended Audio Description (Prerecorded)',
    description: 'Extended audio description is provided when pauses in audio are insufficient'
  },
  '1.2.8': {
    id: '1.2.8',
    level: 'AAA',
    title: 'Media Alternative (Prerecorded)',
    description: 'Alternative for time-based media is provided for prerecorded synchronized media'
  },
  '1.2.9': {
    id: '1.2.9',
    level: 'AAA',
    title: 'Audio-only (Live)',
    description: 'Alternative for time-based media is provided for live audio-only content'
  },

  // Guideline 1.3: Adaptable
  '1.3.1': {
    id: '1.3.1',
    level: 'A',
    title: 'Info and Relationships',
    description: 'Information, structure, and relationships can be programmatically determined'
  },
  '1.3.2': {
    id: '1.3.2',
    level: 'A',
    title: 'Meaningful Sequence',
    description: 'Correct reading sequence can be programmatically determined'
  },
  '1.3.3': {
    id: '1.3.3',
    level: 'A',
    title: 'Sensory Characteristics',
    description: 'Instructions do not rely solely on sensory characteristics'
  },
  '1.3.4': {
    id: '1.3.4',
    level: 'AA',
    title: 'Orientation',
    description: 'Content does not restrict its view and operation to a single display orientation'
  },
  '1.3.5': {
    id: '1.3.5',
    level: 'AA',
    title: 'Identify Input Purpose',
    description: 'Purpose of input fields can be programmatically determined'
  },
  '1.3.6': {
    id: '1.3.6',
    level: 'AAA',
    title: 'Identify Purpose',
    description: 'Purpose of UI components, icons, and regions can be programmatically determined'
  },

  // Guideline 1.4: Distinguishable
  '1.4.1': {
    id: '1.4.1',
    level: 'A',
    title: 'Use of Color',
    description: 'Color is not used as the only visual means of conveying information'
  },
  '1.4.2': {
    id: '1.4.2',
    level: 'A',
    title: 'Audio Control',
    description: 'Mechanism is available to pause or stop audio that plays automatically'
  },
  '1.4.3': {
    id: '1.4.3',
    level: 'AA',
    title: 'Contrast (Minimum)',
    description: 'Text has a contrast ratio of at least 4.5:1 (3:1 for large text)'
  },
  '1.4.4': {
    id: '1.4.4',
    level: 'AA',
    title: 'Resize Text',
    description: 'Text can be resized up to 200% without loss of content or functionality'
  },
  '1.4.5': {
    id: '1.4.5',
    level: 'AA',
    title: 'Images of Text',
    description: 'Text is used instead of images of text, with limited exceptions'
  },
  '1.4.6': {
    id: '1.4.6',
    level: 'AAA',
    title: 'Contrast (Enhanced)',
    description: 'Text has a contrast ratio of at least 7:1 (4.5:1 for large text)'
  },
  '1.4.7': {
    id: '1.4.7',
    level: 'AAA',
    title: 'Low or No Background Audio',
    description: 'Prerecorded audio has minimal or no background sounds'
  },
  '1.4.8': {
    id: '1.4.8',
    level: 'AAA',
    title: 'Visual Presentation',
    description: 'Visual presentation of text blocks provides specific formatting controls'
  },
  '1.4.9': {
    id: '1.4.9',
    level: 'AAA',
    title: 'Images of Text (No Exception)',
    description: 'Images of text are only used for decoration or where essential'
  },
  '1.4.10': {
    id: '1.4.10',
    level: 'AA',
    title: 'Reflow',
    description: 'Content can be presented without horizontal scrolling at 320 CSS pixels width'
  },
  '1.4.11': {
    id: '1.4.11',
    level: 'AA',
    title: 'Non-text Contrast',
    description: 'UI components and graphical objects have a contrast ratio of at least 3:1'
  },
  '1.4.12': {
    id: '1.4.12',
    level: 'AA',
    title: 'Text Spacing',
    description: 'No loss of content or functionality when text spacing is adjusted'
  },
  '1.4.13': {
    id: '1.4.13',
    level: 'AA',
    title: 'Content on Hover or Focus',
    description: 'Additional content triggered by hover or focus is dismissible, hoverable, and persistent'
  },

  // Principle 2: Operable
  // Guideline 2.1: Keyboard Accessible
  '2.1.1': {
    id: '2.1.1',
    level: 'A',
    title: 'Keyboard',
    description: 'All functionality is available from a keyboard'
  },
  '2.1.2': {
    id: '2.1.2',
    level: 'A',
    title: 'No Keyboard Trap',
    description: 'Keyboard focus can be moved away from any component'
  },
  '2.1.3': {
    id: '2.1.3',
    level: 'AAA',
    title: 'Keyboard (No Exception)',
    description: 'All functionality is available from a keyboard without exception'
  },
  '2.1.4': {
    id: '2.1.4',
    level: 'A',
    title: 'Character Key Shortcuts',
    description: 'Character key shortcuts can be turned off, remapped, or only active on focus'
  },

  // Guideline 2.2: Enough Time
  '2.2.1': {
    id: '2.2.1',
    level: 'A',
    title: 'Timing Adjustable',
    description: 'Time limits can be turned off, adjusted, or extended'
  },
  '2.2.2': {
    id: '2.2.2',
    level: 'A',
    title: 'Pause, Stop, Hide',
    description: 'Moving, blinking, or auto-updating content can be paused, stopped, or hidden'
  },
  '2.2.3': {
    id: '2.2.3',
    level: 'AAA',
    title: 'No Timing',
    description: 'Timing is not an essential part of the event or activity'
  },
  '2.2.4': {
    id: '2.2.4',
    level: 'AAA',
    title: 'Interruptions',
    description: 'Interruptions can be postponed or suppressed'
  },
  '2.2.5': {
    id: '2.2.5',
    level: 'AAA',
    title: 'Re-authenticating',
    description: 'User can continue activity without loss of data after re-authenticating'
  },
  '2.2.6': {
    id: '2.2.6',
    level: 'AAA',
    title: 'Timeouts',
    description: 'Users are warned of the duration of any user inactivity that could cause data loss'
  },

  // Guideline 2.3: Seizures and Physical Reactions
  '2.3.1': {
    id: '2.3.1',
    level: 'A',
    title: 'Three Flashes or Below Threshold',
    description: 'Content does not contain anything that flashes more than three times per second'
  },
  '2.3.2': {
    id: '2.3.2',
    level: 'AAA',
    title: 'Three Flashes',
    description: 'Web pages do not contain anything that flashes more than three times per second'
  },
  '2.3.3': {
    id: '2.3.3',
    level: 'AAA',
    title: 'Animation from Interactions',
    description: 'Motion animation triggered by interaction can be disabled'
  },

  // Guideline 2.4: Navigable
  '2.4.1': {
    id: '2.4.1',
    level: 'A',
    title: 'Bypass Blocks',
    description: 'Mechanism is available to bypass blocks of repeated content'
  },
  '2.4.2': {
    id: '2.4.2',
    level: 'A',
    title: 'Page Titled',
    description: 'Web pages have titles that describe topic or purpose'
  },
  '2.4.3': {
    id: '2.4.3',
    level: 'A',
    title: 'Focus Order',
    description: 'Focusable components receive focus in a logical order'
  },
  '2.4.4': {
    id: '2.4.4',
    level: 'A',
    title: 'Link Purpose (In Context)',
    description: 'Purpose of each link can be determined from link text or context'
  },
  '2.4.5': {
    id: '2.4.5',
    level: 'AA',
    title: 'Multiple Ways',
    description: 'More than one way is available to locate a web page within a set'
  },
  '2.4.6': {
    id: '2.4.6',
    level: 'AA',
    title: 'Headings and Labels',
    description: 'Headings and labels describe topic or purpose'
  },
  '2.4.7': {
    id: '2.4.7',
    level: 'AA',
    title: 'Focus Visible',
    description: 'Keyboard focus indicator is visible'
  },
  '2.4.8': {
    id: '2.4.8',
    level: 'AAA',
    title: 'Location',
    description: 'Information about user location within a set of web pages is available'
  },
  '2.4.9': {
    id: '2.4.9',
    level: 'AAA',
    title: 'Link Purpose (Link Only)',
    description: 'Purpose of each link can be identified from link text alone'
  },
  '2.4.10': {
    id: '2.4.10',
    level: 'AAA',
    title: 'Section Headings',
    description: 'Section headings are used to organize content'
  },

  // Guideline 2.5: Input Modalities
  '2.5.1': {
    id: '2.5.1',
    level: 'A',
    title: 'Pointer Gestures',
    description: 'Functionality that uses multipoint or path-based gestures has single pointer alternative'
  },
  '2.5.2': {
    id: '2.5.2',
    level: 'A',
    title: 'Pointer Cancellation',
    description: 'Single pointer operation can be aborted or undone'
  },
  '2.5.3': {
    id: '2.5.3',
    level: 'A',
    title: 'Label in Name',
    description: 'Accessible name contains the visible label text'
  },
  '2.5.4': {
    id: '2.5.4',
    level: 'A',
    title: 'Motion Actuation',
    description: 'Functionality triggered by device motion can also be operated by UI components'
  },
  '2.5.5': {
    id: '2.5.5',
    level: 'AAA',
    title: 'Target Size',
    description: 'Target size for pointer inputs is at least 44x44 CSS pixels'
  },
  '2.5.6': {
    id: '2.5.6',
    level: 'AAA',
    title: 'Concurrent Input Mechanisms',
    description: 'Content does not restrict use of input modalities available on a platform'
  },

  // Principle 3: Understandable
  // Guideline 3.1: Readable
  '3.1.1': {
    id: '3.1.1',
    level: 'A',
    title: 'Language of Page',
    description: 'Default human language of page can be programmatically determined'
  },
  '3.1.2': {
    id: '3.1.2',
    level: 'AA',
    title: 'Language of Parts',
    description: 'Human language of each passage or phrase can be programmatically determined'
  },
  '3.1.3': {
    id: '3.1.3',
    level: 'AAA',
    title: 'Unusual Words',
    description: 'Mechanism is available for identifying specific definitions of unusual words'
  },
  '3.1.4': {
    id: '3.1.4',
    level: 'AAA',
    title: 'Abbreviations',
    description: 'Mechanism is available for identifying expanded form of abbreviations'
  },
  '3.1.5': {
    id: '3.1.5',
    level: 'AAA',
    title: 'Reading Level',
    description: 'Supplemental content or lower reading level version is available'
  },
  '3.1.6': {
    id: '3.1.6',
    level: 'AAA',
    title: 'Pronunciation',
    description: 'Mechanism is available for identifying pronunciation of ambiguous words'
  },

  // Guideline 3.2: Predictable
  '3.2.1': {
    id: '3.2.1',
    level: 'A',
    title: 'On Focus',
    description: 'Receiving focus does not initiate a change of context'
  },
  '3.2.2': {
    id: '3.2.2',
    level: 'A',
    title: 'On Input',
    description: 'Changing the setting of a UI component does not automatically cause a change of context'
  },
  '3.2.3': {
    id: '3.2.3',
    level: 'AA',
    title: 'Consistent Navigation',
    description: 'Navigational mechanisms that are repeated are in consistent order'
  },
  '3.2.4': {
    id: '3.2.4',
    level: 'AA',
    title: 'Consistent Identification',
    description: 'Components with same functionality are identified consistently'
  },
  '3.2.5': {
    id: '3.2.5',
    level: 'AAA',
    title: 'Change on Request',
    description: 'Changes of context are initiated only by user request or can be turned off'
  },

  // Guideline 3.3: Input Assistance
  '3.3.1': {
    id: '3.3.1',
    level: 'A',
    title: 'Error Identification',
    description: 'Input errors are automatically detected and described in text'
  },
  '3.3.2': {
    id: '3.3.2',
    level: 'A',
    title: 'Labels or Instructions',
    description: 'Labels or instructions are provided when content requires user input'
  },
  '3.3.3': {
    id: '3.3.3',
    level: 'AA',
    title: 'Error Suggestion',
    description: 'Suggestions for correcting input errors are provided'
  },
  '3.3.4': {
    id: '3.3.4',
    level: 'AA',
    title: 'Error Prevention (Legal, Financial, Data)',
    description: 'Submissions can be reversed, checked, or confirmed for legal/financial/data transactions'
  },
  '3.3.5': {
    id: '3.3.5',
    level: 'AAA',
    title: 'Help',
    description: 'Context-sensitive help is available'
  },
  '3.3.6': {
    id: '3.3.6',
    level: 'AAA',
    title: 'Error Prevention (All)',
    description: 'Submissions can be reversed, checked, or confirmed for all user input'
  },

  // Principle 4: Robust
  // Guideline 4.1: Compatible
  '4.1.1': {
    id: '4.1.1',
    level: 'A',
    title: 'Parsing',
    description: 'Content can be reliably parsed by assistive technologies'
  },
  '4.1.2': {
    id: '4.1.2',
    level: 'A',
    title: 'Name, Role, Value',
    description: 'Name and role can be programmatically determined for UI components'
  },
  '4.1.3': {
    id: '4.1.3',
    level: 'AA',
    title: 'Status Messages',
    description: 'Status messages can be programmatically determined without receiving focus'
  }
};

/**
 * Mapping of axe-core rule IDs to WCAG 2.1 criterion IDs
 *
 * This mapping helps translate axe-core test results to specific WCAG criteria.
 * Note: Some axe-core rules may map to multiple WCAG criteria, and some WCAG
 * criteria cannot be fully tested by automated tools.
 */
export const AXE_RULE_TO_WCAG: Record<string, string[]> = {
  // Images and alternative text
  'image-alt': ['1.1.1'],
  'input-image-alt': ['1.1.1'],
  'area-alt': ['1.1.1'],
  'svg-img-alt': ['1.1.1'],
  'object-alt': ['1.1.1'],
  'image-redundant-alt': ['1.1.1'],

  // Color and contrast
  'color-contrast': ['1.4.3'],
  'color-contrast-enhanced': ['1.4.6'],
  'link-in-text-block': ['1.4.1'],

  // Semantic structure
  'page-has-heading-one': ['1.3.1'],
  'heading-order': ['1.3.1'],
  'list': ['1.3.1'],
  'listitem': ['1.3.1'],
  'definition-list': ['1.3.1'],
  'dlitem': ['1.3.1'],
  'table-duplicate-name': ['1.3.1'],
  'td-headers-attr': ['1.3.1'],
  'th-has-data-cells': ['1.3.1'],
  'layout-table': ['1.3.1'],
  'scope-attr-valid': ['1.3.1'],
  'td-has-header': ['1.3.1'],

  // Forms and labels
  'label': ['1.3.1', '3.3.2'],
  'label-title-only': ['1.3.1', '3.3.2'],
  'label-content-name-mismatch': ['2.5.3', '3.3.2'],
  'input-button-name': ['4.1.2'],
  'select-name': ['4.1.2'],
  'form-field-multiple-labels': ['3.3.2'],
  'fieldset-legend': ['1.3.1', '3.3.2'],

  // Keyboard and focus
  'accesskeys': ['2.1.1'],
  'tabindex': ['2.1.1'],
  'focus-order-semantics': ['2.4.3'],

  // Links
  'link-name': ['2.4.4', '4.1.2'],
  'identical-links-same-purpose': ['2.4.4'],

  // Page structure
  'bypass': ['2.4.1'],
  'document-title': ['2.4.2'],
  'html-has-lang': ['3.1.1'],
  'html-lang-valid': ['3.1.1'],
  'valid-lang': ['3.1.2'],
  'html-xml-lang-mismatch': ['3.1.1'],

  // Landmarks and regions
  'landmark-one-main': ['1.3.1'],
  'landmark-complementary-is-top-level': ['1.3.1'],
  'landmark-no-duplicate-banner': ['1.3.1'],
  'landmark-no-duplicate-contentinfo': ['1.3.1'],
  'landmark-unique': ['1.3.1'],
  'region': ['1.3.1'],

  // ARIA
  'aria-allowed-attr': ['4.1.2'],
  'aria-allowed-role': ['4.1.2'],
  'aria-hidden-body': ['4.1.2'],
  'aria-hidden-focus': ['1.3.1', '4.1.2'],
  'aria-input-field-name': ['4.1.2'],
  'aria-required-attr': ['4.1.2'],
  'aria-required-children': ['1.3.1'],
  'aria-required-parent': ['1.3.1'],
  'aria-roledescription': ['4.1.2'],
  'aria-roles': ['4.1.2'],
  'aria-toggle-field-name': ['4.1.2'],
  'aria-valid-attr-value': ['4.1.2'],
  'aria-valid-attr': ['4.1.2'],

  // Buttons
  'button-name': ['4.1.2'],
  'role-img-alt': ['1.1.1'],

  // Video/Audio
  'audio-caption': ['1.2.2'],
  'video-caption': ['1.2.2'],
  'video-description': ['1.2.5'],

  // Timing
  'meta-refresh': ['2.2.1', '2.2.4', '3.2.5'],
  'meta-viewport': ['1.4.4'],
  'meta-viewport-large': ['1.4.4'],

  // Parsing
  'duplicate-id': ['4.1.1'],
  'duplicate-id-active': ['4.1.1'],
  'duplicate-id-aria': ['4.1.1'],

  // Misc
  'frame-title': ['2.4.1', '4.1.2'],
  'frame-title-unique': ['4.1.2'],
  'marquee': ['2.2.2'],
  'blink': ['2.2.2'],
  'scrollable-region-focusable': ['2.1.1'],
  'autocomplete-valid': ['1.3.5'],
  'avoid-inline-spacing': ['1.4.12']
};

/**
 * Get all WCAG criteria for a specific level
 */
export function getCriteriaByLevel(level: WCAGLevel): WCAGCriterion[] {
  return Object.values(WCAG_CRITERIA).filter(criterion => criterion.level === level);
}

/**
 * Get all WCAG criteria up to and including a specific level
 * (e.g., 'AA' returns both A and AA criteria)
 */
export function getCriteriaUpToLevel(level: WCAGLevel): WCAGCriterion[] {
  const levels: WCAGLevel[] = level === 'AAA'
    ? ['A', 'AA', 'AAA']
    : level === 'AA'
      ? ['A', 'AA']
      : ['A'];

  return Object.values(WCAG_CRITERIA).filter(criterion =>
    levels.includes(criterion.level)
  );
}

/**
 * Get WCAG criteria associated with an axe-core rule ID
 */
export function getWCAGForAxeRule(ruleId: string): WCAGCriterion[] {
  const wcagIds = AXE_RULE_TO_WCAG[ruleId] || [];
  return wcagIds.map(id => WCAG_CRITERIA[id]).filter((criterion): criterion is WCAGCriterion => Boolean(criterion));
}

/**
 * List of WCAG criteria that cannot be fully tested by automated tools (axe-core)
 * and require human judgment or AI analysis.
 *
 * These criteria require understanding of:
 * - Content semantics and meaning
 * - Context and purpose
 * - User experience factors
 * - Audio/video content analysis
 */
export const UNTESTABLE_CRITERIA: string[] = [
  // 1.1.x - Images and text alternatives require semantic understanding
  // (1.1.1 is partially testable - presence check, not quality)

  // 1.2.x - Time-based media (audio/video content analysis)
  '1.2.1',  // Audio-only and Video-only
  '1.2.2',  // Captions (Prerecorded) - quality check
  '1.2.3',  // Audio Description or Media Alternative
  '1.2.4',  // Captions (Live)
  '1.2.5',  // Audio Description (Prerecorded)
  '1.2.6',  // Sign Language (AAA)
  '1.2.7',  // Extended Audio Description (AAA)
  '1.2.8',  // Media Alternative (AAA)
  '1.2.9',  // Audio-only Live (AAA)

  // 1.3.x - Semantic understanding
  '1.3.2',  // Meaningful Sequence - requires understanding reading order
  '1.3.3',  // Sensory Characteristics - instructions context

  // 1.4.x - Presentation and visual aspects
  '1.4.1',  // Use of Color - requires understanding content meaning
  '1.4.2',  // Audio Control
  '1.4.5',  // Images of Text - requires OCR and context
  '1.4.7',  // Low or No Background Audio (AAA)
  '1.4.8',  // Visual Presentation (AAA)
  '1.4.9',  // Images of Text - No Exception (AAA)

  // 2.1.x - Keyboard accessibility
  '2.1.4',  // Character Key Shortcuts - requires interaction testing

  // 2.2.x - Timing
  '2.2.1',  // Timing Adjustable - requires interaction testing
  '2.2.2',  // Pause, Stop, Hide - partial, requires content analysis
  '2.2.3',  // No Timing (AAA)
  '2.2.4',  // Interruptions (AAA)
  '2.2.5',  // Re-authenticating (AAA)
  '2.2.6',  // Timeouts (AAA)

  // 2.3.x - Seizures
  '2.3.1',  // Three Flashes - requires video analysis
  '2.3.2',  // Three Flashes (AAA)
  '2.3.3',  // Animation from Interactions (AAA)

  // 2.4.x - Navigation
  '2.4.5',  // Multiple Ways - requires site-level analysis
  '2.4.6',  // Headings and Labels - requires semantic understanding
  '2.4.8',  // Location (AAA)
  '2.4.9',  // Link Purpose - Link Only (AAA)
  '2.4.10', // Section Headings (AAA)

  // 2.5.x - Input modalities
  '2.5.1',  // Pointer Gestures - requires interaction testing
  '2.5.2',  // Pointer Cancellation
  '2.5.4',  // Motion Actuation
  '2.5.5',  // Target Size (AAA)
  '2.5.6',  // Concurrent Input Mechanisms (AAA)

  // 3.1.x - Readable
  '3.1.3',  // Unusual Words (AAA)
  '3.1.4',  // Abbreviations (AAA)
  '3.1.5',  // Reading Level (AAA)
  '3.1.6',  // Pronunciation (AAA)

  // 3.2.x - Predictable
  '3.2.1',  // On Focus - requires interaction testing
  '3.2.2',  // On Input - requires interaction testing
  '3.2.3',  // Consistent Navigation - requires multi-page analysis
  '3.2.4',  // Consistent Identification - requires multi-page analysis
  '3.2.5',  // Change on Request (AAA)

  // 3.3.x - Input Assistance
  '3.3.3',  // Error Suggestion - requires form testing
  '3.3.4',  // Error Prevention - requires transaction analysis
  '3.3.5',  // Help (AAA)
  '3.3.6',  // Error Prevention - All (AAA)
];

/**
 * Get untestable WCAG criteria filtered by conformance level
 */
export function getUntestableCriteria(level: WCAGLevel): WCAGCriterion[] {
  const criteriaUpToLevel = getCriteriaUpToLevel(level);
  const criteriaIds = criteriaUpToLevel.map(c => c.id);

  return UNTESTABLE_CRITERIA
    .filter(id => criteriaIds.includes(id))
    .map(id => WCAG_CRITERIA[id])
    .filter((criterion): criterion is WCAGCriterion => Boolean(criterion));
}

/**
 * Get criteria that ARE testable by axe-core for a given level
 */
export function getTestableCriteria(level: WCAGLevel): WCAGCriterion[] {
  const criteriaUpToLevel = getCriteriaUpToLevel(level);

  return criteriaUpToLevel.filter(
    criterion => !UNTESTABLE_CRITERIA.includes(criterion.id)
  );
}

/**
 * Get all unique WCAG criteria IDs covered by axe-core rules
 */
export function getAxeCoveredCriteria(): string[] {
  const coveredCriteria = new Set<string>();

  Object.values(AXE_RULE_TO_WCAG).forEach(criteriaIds => {
    criteriaIds.forEach(id => coveredCriteria.add(id));
  });

  return Array.from(coveredCriteria).sort();
}
