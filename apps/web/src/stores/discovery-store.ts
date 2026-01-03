import { create } from 'zustand';

/**
 * Discovery flow steps
 * 0: URL input and configuration
 * 1: Discovery mode selection (auto/manual)
 * 2: Progress/discovery running
 * 3: Results/page selection
 */
export type DiscoveryStep = 0 | 1 | 2 | 3;

/**
 * Discovery flow state
 */
interface DiscoveryFlowState {
  /** Current discovery ID being worked on */
  discoveryId: string | null;
  /** Currently selected page IDs for batch scanning */
  selectedPages: string[];
  /** Current step in the discovery flow (0-3) */
  currentStep: DiscoveryStep;
  /** Navigation history for back button functionality */
  stepHistory: number[];
}

/**
 * Discovery flow actions
 */
interface DiscoveryFlowActions {
  /**
   * Set the discovery ID
   * @param id - Discovery ID or null to reset
   */
  setDiscoveryId: (id: string | null) => void;

  /**
   * Set selected page IDs
   * @param pages - Array of page IDs
   */
  setSelectedPages: (pages: string[]) => void;

  /**
   * Navigate to a specific step
   * @param step - Target step number (0-3)
   */
  goToStep: (step: DiscoveryStep) => void;

  /**
   * Navigate to the previous step
   * Uses stepHistory to restore previous navigation state
   */
  goBack: () => void;

  /**
   * Check if back navigation is available
   * @returns true if there is a previous step in history
   */
  canGoBack: () => boolean;

  /**
   * Reset the entire flow state to initial values
   */
  resetFlow: () => void;
}

/**
 * Combined store type
 */
type DiscoveryFlowStore = DiscoveryFlowState & DiscoveryFlowActions;

/**
 * Initial state
 */
const initialState: DiscoveryFlowState = {
  discoveryId: null,
  selectedPages: [],
  currentStep: 0,
  stepHistory: [],
};

/**
 * Discovery flow store
 * Manages step-by-step navigation through the website discovery process
 * with support for back navigation and data persistence across steps.
 *
 * Usage:
 * ```tsx
 * const { currentStep, goToStep, canGoBack, goBack } = useDiscoveryFlowStore();
 *
 * // Navigate forward
 * goToStep(1);
 *
 * // Navigate back
 * if (canGoBack()) {
 *   goBack();
 * }
 * ```
 */
export const useDiscoveryFlowStore = create<DiscoveryFlowStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions
  setDiscoveryId: (id: string | null) => {
    set({ discoveryId: id });
  },

  setSelectedPages: (pages: string[]) => {
    set({ selectedPages: pages });
  },

  goToStep: (step: DiscoveryStep) => {
    set((state) => {
      // Add current step to history before navigating
      // This allows back navigation to restore previous state
      const newHistory = [...state.stepHistory, state.currentStep];

      return {
        currentStep: step,
        stepHistory: newHistory,
      };
    });
  },

  goBack: () => {
    set((state) => {
      // No history to go back to
      if (state.stepHistory.length === 0) {
        return state;
      }

      // Get the last step from history
      const previousStep = state.stepHistory[state.stepHistory.length - 1];
      // Remove the last step from history
      const newHistory = state.stepHistory.slice(0, -1);

      return {
        currentStep: previousStep as DiscoveryStep,
        stepHistory: newHistory,
      };
    });
  },

  canGoBack: () => {
    const state = get();
    return state.stepHistory.length > 0;
  },

  resetFlow: () => {
    set(initialState);
  },
}));
