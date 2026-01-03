import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiscoveryError } from '@/types/discovery-errors';
import type { ParsedUrl } from '@/lib/url-utils';

/**
 * Discovery Flow V2 Step Types
 * Represents the 3-step discovery flow redesign
 */
export type FlowStep = 'input' | 'select' | 'preview';

/**
 * Input Method Types
 * Determines how URLs are provided to the discovery flow
 */
export type InputMethod = 'sitemap' | 'manual';

/**
 * Discovery Flow V2 State
 */
interface DiscoveryFlowV2State {
  /** Current step in the discovery flow (input → select → preview) */
  currentStep: FlowStep;

  /** Selected input method (sitemap or manual) */
  inputMethod: InputMethod | null;

  /** Sitemap URL when using sitemap input method */
  sitemapUrl: string;

  /** Raw manual input when using manual input method */
  manualInput: string;

  /** Parsed and validated URLs ready for selection */
  parsedUrls: ParsedUrl[];

  /** Set of selected URL IDs for batch scanning */
  selectedIds: Set<string>;

  /** Loading state for async operations (e.g., sitemap parsing) */
  isLoading: boolean;

  /** Submitting state for final batch creation */
  isSubmitting: boolean;

  /** Current error state */
  error: DiscoveryError | null;
}

/**
 * Discovery Flow V2 Actions
 */
interface DiscoveryFlowV2Actions {
  // Navigation actions
  /**
   * Navigate to a specific step in the flow
   * @param step - Target step (input, select, or preview)
   */
  setCurrentStep: (step: FlowStep) => void;

  // Input method actions
  /**
   * Set the input method (sitemap or manual)
   * @param method - Input method type
   */
  setInputMethod: (method: InputMethod) => void;

  /**
   * Set the sitemap URL
   * @param url - Sitemap URL string
   */
  setSitemapUrl: (url: string) => void;

  /**
   * Set the manual input text
   * @param input - Raw manual input (semicolon-separated or multi-line)
   */
  setManualInput: (input: string) => void;

  // URL management actions
  /**
   * Set the parsed URLs from sitemap or manual input
   * @param urls - Array of parsed and validated URLs
   */
  setParsedUrls: (urls: ParsedUrl[]) => void;

  // Selection actions
  /**
   * Set selected URL IDs (replaces entire selection)
   * @param ids - Set of URL IDs
   */
  setSelectedIds: (ids: Set<string>) => void;

  /**
   * Toggle selection state of a single URL
   * @param id - URL ID to toggle
   */
  toggleSelection: (id: string) => void;

  /**
   * Select all parsed URLs
   */
  selectAll: () => void;

  /**
   * Deselect all URLs
   */
  deselectAll: () => void;

  // State management actions
  /**
   * Set loading state
   * @param loading - Loading state
   */
  setLoading: (loading: boolean) => void;

  /**
   * Set submitting state
   * @param submitting - Submitting state
   */
  setSubmitting: (submitting: boolean) => void;

  /**
   * Set error state
   * @param error - Discovery error or null to clear
   */
  setError: (error: DiscoveryError | null) => void;

  /**
   * Reset the entire flow to initial state
   */
  reset: () => void;

  // Computed getters
  /**
   * Check if user can proceed from input step to select step
   * @returns true if input method is selected and URLs are parsed
   */
  canProceedToSelect: () => boolean;

  /**
   * Check if user can proceed from select step to preview step
   * @returns true if at least one URL is selected
   */
  canProceedToPreview: () => boolean;

  /**
   * Get array of selected ParsedUrl objects
   * @returns Array of selected URLs
   */
  getSelectedUrls: () => ParsedUrl[];
}

/**
 * Combined store type
 */
type DiscoveryFlowV2Store = DiscoveryFlowV2State & DiscoveryFlowV2Actions;

/**
 * Initial state
 */
const initialState: DiscoveryFlowV2State = {
  currentStep: 'input',
  inputMethod: null,
  sitemapUrl: '',
  manualInput: '',
  parsedUrls: [],
  selectedIds: new Set<string>(),
  isLoading: false,
  isSubmitting: false,
  error: null,
};

/**
 * Discovery Flow V2 Store
 *
 * Manages the 3-step discovery flow redesign:
 * 1. Input: Choose input method (sitemap or manual) and provide URLs
 * 2. Select: Review and select URLs from parsed results
 * 3. Preview: Review selection before creating batch scan
 *
 * Features:
 * - Session storage persistence (FR-5.1)
 * - Selection state preservation across steps (FR-5.2)
 * - Set-based selection management with proper serialization
 * - Validation helpers for step navigation
 *
 * Usage:
 * ```tsx
 * const {
 *   currentStep,
 *   inputMethod,
 *   setInputMethod,
 *   setParsedUrls,
 *   toggleSelection,
 *   canProceedToSelect,
 *   getSelectedUrls
 * } = useDiscoveryFlowV2Store();
 *
 * // Set input method
 * setInputMethod('sitemap');
 *
 * // After parsing sitemap
 * setParsedUrls(parsedUrlsFromApi);
 *
 * // Select URLs
 * toggleSelection(urlId);
 *
 * // Check if can proceed
 * if (canProceedToSelect()) {
 *   setCurrentStep('select');
 * }
 * ```
 */
export const useDiscoveryFlowV2Store = create<DiscoveryFlowV2Store>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Navigation actions
      setCurrentStep: (step: FlowStep) => {
        set({ currentStep: step });
      },

      // Input method actions
      setInputMethod: (method: InputMethod) => {
        set({ inputMethod: method });
      },

      setSitemapUrl: (url: string) => {
        set({ sitemapUrl: url });
      },

      setManualInput: (input: string) => {
        set({ manualInput: input });
      },

      // URL management actions
      setParsedUrls: (urls: ParsedUrl[]) => {
        set({ parsedUrls: urls });
      },

      // Selection actions
      setSelectedIds: (ids: Set<string>) => {
        set({ selectedIds: ids });
      },

      toggleSelection: (id: string) => {
        set((state) => {
          const newSelectedIds = new Set(state.selectedIds);
          if (newSelectedIds.has(id)) {
            newSelectedIds.delete(id);
          } else {
            newSelectedIds.add(id);
          }
          return { selectedIds: newSelectedIds };
        });
      },

      selectAll: () => {
        set((state) => {
          const allIds = new Set(state.parsedUrls.map((url) => url.id));
          return { selectedIds: allIds };
        });
      },

      deselectAll: () => {
        set({ selectedIds: new Set<string>() });
      },

      // State management actions
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setSubmitting: (submitting: boolean) => {
        set({ isSubmitting: submitting });
      },

      setError: (error: DiscoveryError | null) => {
        set({ error });
      },

      reset: () => {
        set(initialState);
      },

      // Computed getters
      canProceedToSelect: () => {
        const state = get();
        // Must have input method selected and at least one parsed URL
        return state.inputMethod !== null && state.parsedUrls.length > 0;
      },

      canProceedToPreview: () => {
        const state = get();
        // Must have at least one URL selected
        return state.selectedIds.size > 0;
      },

      getSelectedUrls: () => {
        const state = get();
        // Filter parsedUrls to only include selected IDs
        return state.parsedUrls.filter((url) => state.selectedIds.has(url.id));
      },
    }),
    {
      name: 'discovery-flow-v2-storage', // sessionStorage key
      storage: {
        // Use sessionStorage for temporary persistence (FR-5.1)
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);
          // Deserialize Set from array
          if (state.selectedIds && Array.isArray(state.selectedIds)) {
            state.selectedIds = new Set(state.selectedIds);
          }
          return { state };
        },
        setItem: (name, value) => {
          const { state } = value;
          // Serialize Set to array for storage
          const serializedState = {
            ...state,
            selectedIds: Array.from(state.selectedIds),
          };
          sessionStorage.setItem(
            name,
            JSON.stringify({ state: serializedState })
          );
        },
        removeItem: (name) => sessionStorage.removeItem(name),
      },
    }
  )
);
