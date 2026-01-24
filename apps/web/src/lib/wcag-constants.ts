/**
 * WCAG 2.1 Success Criteria Constants (Browser-safe)
 *
 * This is a copy of the essential WCAG constants from @adashield/core/constants
 * for use in browser components. The original constants barrel export includes
 * gdpr.constants which uses Node.js crypto module that doesn't work in browsers.
 *
 * @see packages/core/src/constants/wcag.constants.ts for the source of truth
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
  '1.2.1': { id: '1.2.1', level: 'A', title: 'Audio-only and Video-only (Prerecorded)', description: 'Alternative for time-based media or audio description is provided' },
  '1.2.2': { id: '1.2.2', level: 'A', title: 'Captions (Prerecorded)', description: 'Captions are provided for prerecorded audio content in synchronized media' },
  '1.2.3': { id: '1.2.3', level: 'A', title: 'Audio Description or Media Alternative (Prerecorded)', description: 'Audio description or full text alternative is provided for prerecorded video' },
  '1.2.4': { id: '1.2.4', level: 'AA', title: 'Captions (Live)', description: 'Captions are provided for all live audio content in synchronized media' },
  '1.2.5': { id: '1.2.5', level: 'AA', title: 'Audio Description (Prerecorded)', description: 'Audio description is provided for all prerecorded video content' },
  '1.2.6': { id: '1.2.6', level: 'AAA', title: 'Sign Language (Prerecorded)', description: 'Sign language interpretation is provided for prerecorded audio content' },
  '1.2.7': { id: '1.2.7', level: 'AAA', title: 'Extended Audio Description (Prerecorded)', description: 'Extended audio description is provided when pauses in audio are insufficient' },
  '1.2.8': { id: '1.2.8', level: 'AAA', title: 'Media Alternative (Prerecorded)', description: 'Alternative for time-based media is provided for prerecorded synchronized media' },
  '1.2.9': { id: '1.2.9', level: 'AAA', title: 'Audio-only (Live)', description: 'Alternative for time-based media is provided for live audio-only content' },

  // Guideline 1.3: Adaptable
  '1.3.1': { id: '1.3.1', level: 'A', title: 'Info and Relationships', description: 'Information, structure, and relationships can be programmatically determined' },
  '1.3.2': { id: '1.3.2', level: 'A', title: 'Meaningful Sequence', description: 'Correct reading sequence can be programmatically determined' },
  '1.3.3': { id: '1.3.3', level: 'A', title: 'Sensory Characteristics', description: 'Instructions do not rely solely on sensory characteristics' },
  '1.3.4': { id: '1.3.4', level: 'AA', title: 'Orientation', description: 'Content does not restrict its view and operation to a single display orientation' },
  '1.3.5': { id: '1.3.5', level: 'AA', title: 'Identify Input Purpose', description: 'Purpose of input fields can be programmatically determined' },
  '1.3.6': { id: '1.3.6', level: 'AAA', title: 'Identify Purpose', description: 'Purpose of UI components, icons, and regions can be programmatically determined' },

  // Guideline 1.4: Distinguishable
  '1.4.1': { id: '1.4.1', level: 'A', title: 'Use of Color', description: 'Color is not used as the only visual means of conveying information' },
  '1.4.2': { id: '1.4.2', level: 'A', title: 'Audio Control', description: 'Mechanism is available to pause or stop audio that plays automatically' },
  '1.4.3': { id: '1.4.3', level: 'AA', title: 'Contrast (Minimum)', description: 'Text has a contrast ratio of at least 4.5:1 (3:1 for large text)' },
  '1.4.4': { id: '1.4.4', level: 'AA', title: 'Resize Text', description: 'Text can be resized up to 200% without loss of content or functionality' },
  '1.4.5': { id: '1.4.5', level: 'AA', title: 'Images of Text', description: 'Text is used instead of images of text, with limited exceptions' },
  '1.4.6': { id: '1.4.6', level: 'AAA', title: 'Contrast (Enhanced)', description: 'Text has a contrast ratio of at least 7:1 (4.5:1 for large text)' },
  '1.4.7': { id: '1.4.7', level: 'AAA', title: 'Low or No Background Audio', description: 'Prerecorded audio has minimal or no background sounds' },
  '1.4.8': { id: '1.4.8', level: 'AAA', title: 'Visual Presentation', description: 'Visual presentation of text blocks provides specific formatting controls' },
  '1.4.9': { id: '1.4.9', level: 'AAA', title: 'Images of Text (No Exception)', description: 'Images of text are only used for decoration or where essential' },
  '1.4.10': { id: '1.4.10', level: 'AA', title: 'Reflow', description: 'Content can be presented without horizontal scrolling at 320 CSS pixels width' },
  '1.4.11': { id: '1.4.11', level: 'AA', title: 'Non-text Contrast', description: 'UI components and graphical objects have a contrast ratio of at least 3:1' },
  '1.4.12': { id: '1.4.12', level: 'AA', title: 'Text Spacing', description: 'No loss of content or functionality when text spacing is adjusted' },
  '1.4.13': { id: '1.4.13', level: 'AA', title: 'Content on Hover or Focus', description: 'Additional content triggered by hover or focus is dismissible, hoverable, and persistent' },

  // Principle 2: Operable
  // Guideline 2.1: Keyboard Accessible
  '2.1.1': { id: '2.1.1', level: 'A', title: 'Keyboard', description: 'All functionality is available from a keyboard' },
  '2.1.2': { id: '2.1.2', level: 'A', title: 'No Keyboard Trap', description: 'Keyboard focus can be moved away from any component' },
  '2.1.3': { id: '2.1.3', level: 'AAA', title: 'Keyboard (No Exception)', description: 'All functionality is available from a keyboard without exception' },
  '2.1.4': { id: '2.1.4', level: 'A', title: 'Character Key Shortcuts', description: 'Character key shortcuts can be turned off, remapped, or only active on focus' },

  // Guideline 2.2: Enough Time
  '2.2.1': { id: '2.2.1', level: 'A', title: 'Timing Adjustable', description: 'Time limits can be turned off, adjusted, or extended' },
  '2.2.2': { id: '2.2.2', level: 'A', title: 'Pause, Stop, Hide', description: 'Moving, blinking, or auto-updating content can be paused, stopped, or hidden' },
  '2.2.3': { id: '2.2.3', level: 'AAA', title: 'No Timing', description: 'Timing is not an essential part of the event or activity' },
  '2.2.4': { id: '2.2.4', level: 'AAA', title: 'Interruptions', description: 'Interruptions can be postponed or suppressed' },
  '2.2.5': { id: '2.2.5', level: 'AAA', title: 'Re-authenticating', description: 'User can continue activity without loss of data after re-authenticating' },
  '2.2.6': { id: '2.2.6', level: 'AAA', title: 'Timeouts', description: 'Users are warned of the duration of any user inactivity that could cause data loss' },

  // Guideline 2.3: Seizures and Physical Reactions
  '2.3.1': { id: '2.3.1', level: 'A', title: 'Three Flashes or Below Threshold', description: 'Content does not contain anything that flashes more than three times per second' },
  '2.3.2': { id: '2.3.2', level: 'AAA', title: 'Three Flashes', description: 'Web pages do not contain anything that flashes more than three times per second' },
  '2.3.3': { id: '2.3.3', level: 'AAA', title: 'Animation from Interactions', description: 'Motion animation triggered by interaction can be disabled' },

  // Guideline 2.4: Navigable
  '2.4.1': { id: '2.4.1', level: 'A', title: 'Bypass Blocks', description: 'Mechanism is available to bypass blocks of repeated content' },
  '2.4.2': { id: '2.4.2', level: 'A', title: 'Page Titled', description: 'Web pages have titles that describe topic or purpose' },
  '2.4.3': { id: '2.4.3', level: 'A', title: 'Focus Order', description: 'Focusable components receive focus in a logical order' },
  '2.4.4': { id: '2.4.4', level: 'A', title: 'Link Purpose (In Context)', description: 'Purpose of each link can be determined from link text or context' },
  '2.4.5': { id: '2.4.5', level: 'AA', title: 'Multiple Ways', description: 'More than one way is available to locate a web page within a set' },
  '2.4.6': { id: '2.4.6', level: 'AA', title: 'Headings and Labels', description: 'Headings and labels describe topic or purpose' },
  '2.4.7': { id: '2.4.7', level: 'AA', title: 'Focus Visible', description: 'Keyboard focus indicator is visible' },
  '2.4.8': { id: '2.4.8', level: 'AAA', title: 'Location', description: 'Information about user location within a set of web pages is available' },
  '2.4.9': { id: '2.4.9', level: 'AAA', title: 'Link Purpose (Link Only)', description: 'Purpose of each link can be identified from link text alone' },
  '2.4.10': { id: '2.4.10', level: 'AAA', title: 'Section Headings', description: 'Section headings are used to organize content' },

  // Guideline 2.5: Input Modalities
  '2.5.1': { id: '2.5.1', level: 'A', title: 'Pointer Gestures', description: 'Functionality that uses multipoint or path-based gestures has single pointer alternative' },
  '2.5.2': { id: '2.5.2', level: 'A', title: 'Pointer Cancellation', description: 'Single pointer operation can be aborted or undone' },
  '2.5.3': { id: '2.5.3', level: 'A', title: 'Label in Name', description: 'Accessible name contains the visible label text' },
  '2.5.4': { id: '2.5.4', level: 'A', title: 'Motion Actuation', description: 'Functionality triggered by device motion can also be operated by UI components' },
  '2.5.5': { id: '2.5.5', level: 'AAA', title: 'Target Size', description: 'Target size for pointer inputs is at least 44x44 CSS pixels' },
  '2.5.6': { id: '2.5.6', level: 'AAA', title: 'Concurrent Input Mechanisms', description: 'Content does not restrict use of input modalities available on a platform' },

  // Principle 3: Understandable
  // Guideline 3.1: Readable
  '3.1.1': { id: '3.1.1', level: 'A', title: 'Language of Page', description: 'Default human language of page can be programmatically determined' },
  '3.1.2': { id: '3.1.2', level: 'AA', title: 'Language of Parts', description: 'Human language of each passage or phrase can be programmatically determined' },
  '3.1.3': { id: '3.1.3', level: 'AAA', title: 'Unusual Words', description: 'Mechanism is available for identifying specific definitions of unusual words' },
  '3.1.4': { id: '3.1.4', level: 'AAA', title: 'Abbreviations', description: 'Mechanism is available for identifying expanded form of abbreviations' },
  '3.1.5': { id: '3.1.5', level: 'AAA', title: 'Reading Level', description: 'Supplemental content or lower reading level version is available' },
  '3.1.6': { id: '3.1.6', level: 'AAA', title: 'Pronunciation', description: 'Mechanism is available for identifying pronunciation of ambiguous words' },

  // Guideline 3.2: Predictable
  '3.2.1': { id: '3.2.1', level: 'A', title: 'On Focus', description: 'Receiving focus does not initiate a change of context' },
  '3.2.2': { id: '3.2.2', level: 'A', title: 'On Input', description: 'Changing the setting of a UI component does not automatically cause a change of context' },
  '3.2.3': { id: '3.2.3', level: 'AA', title: 'Consistent Navigation', description: 'Navigational mechanisms that are repeated are in consistent order' },
  '3.2.4': { id: '3.2.4', level: 'AA', title: 'Consistent Identification', description: 'Components with same functionality are identified consistently' },
  '3.2.5': { id: '3.2.5', level: 'AAA', title: 'Change on Request', description: 'Changes of context are initiated only by user request or can be turned off' },

  // Guideline 3.3: Input Assistance
  '3.3.1': { id: '3.3.1', level: 'A', title: 'Error Identification', description: 'Input errors are automatically detected and described in text' },
  '3.3.2': { id: '3.3.2', level: 'A', title: 'Labels or Instructions', description: 'Labels or instructions are provided when content requires user input' },
  '3.3.3': { id: '3.3.3', level: 'AA', title: 'Error Suggestion', description: 'Suggestions for correcting input errors are provided' },
  '3.3.4': { id: '3.3.4', level: 'AA', title: 'Error Prevention (Legal, Financial, Data)', description: 'Submissions can be reversed, checked, or confirmed for legal/financial/data transactions' },
  '3.3.5': { id: '3.3.5', level: 'AAA', title: 'Help', description: 'Context-sensitive help is available' },
  '3.3.6': { id: '3.3.6', level: 'AAA', title: 'Error Prevention (All)', description: 'Submissions can be reversed, checked, or confirmed for all user input' },

  // Principle 4: Robust
  // Guideline 4.1: Compatible
  '4.1.1': { id: '4.1.1', level: 'A', title: 'Parsing', description: 'Content can be reliably parsed by assistive technologies' },
  '4.1.2': { id: '4.1.2', level: 'A', title: 'Name, Role, Value', description: 'Name and role can be programmatically determined for UI components' },
  '4.1.3': { id: '4.1.3', level: 'AA', title: 'Status Messages', description: 'Status messages can be programmatically determined without receiving focus' }
};
