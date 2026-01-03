/**
 * StepIndicator Component Examples
 *
 * This file demonstrates various usage patterns for the StepIndicator component.
 * NOT included in production build - for development reference only.
 */

import * as React from "react"
import { StepIndicator } from "./step-indicator"

// Example 1: Basic horizontal step indicator (discovery flow)
export function DiscoveryStepsExample() {
  const steps = [
    { id: "mode", label: "Select Mode" },
    { id: "pages", label: "Select Pages", description: "Choose pages to scan" },
    { id: "review", label: "Review & Start" },
  ]

  return (
    <StepIndicator
      steps={steps}
      currentStep={1}
      variant="horizontal"
      size="md"
    />
  )
}

// Example 2: Vertical step indicator with navigation
export function VerticalNavigableExample() {
  const steps = [
    { id: "info", label: "Basic Information", description: "Enter your details" },
    { id: "config", label: "Configure Scan", description: "Set scan parameters" },
    { id: "schedule", label: "Schedule", description: "When to run the scan" },
    { id: "review", label: "Review", description: "Confirm settings" },
  ]

  const handleStepClick = (index: number) => {
    console.log(`Navigate to step ${index + 1}`)
  }

  return (
    <StepIndicator
      steps={steps}
      currentStep={2}
      variant="vertical"
      size="md"
      allowNavigation
      onStepClick={handleStepClick}
    />
  )
}

// Example 3: Small horizontal without labels (compact mode)
export function CompactStepsExample() {
  const steps = [
    { id: "1", label: "Step 1" },
    { id: "2", label: "Step 2" },
    { id: "3", label: "Step 3" },
    { id: "4", label: "Step 4" },
  ]

  return (
    <StepIndicator
      steps={steps}
      currentStep={2}
      variant="horizontal"
      size="sm"
      showLabels={false}
    />
  )
}

// Example 4: Large vertical with descriptions
export function DetailedStepsExample() {
  const steps = [
    {
      id: "url",
      label: "Enter URL",
      description: "Provide the website URL to scan",
    },
    {
      id: "discover",
      label: "Discover Pages",
      description: "Automatically find all pages on your site",
    },
    {
      id: "select",
      label: "Select Pages",
      description: "Choose which pages to include in the scan",
    },
    {
      id: "scan",
      label: "Run Scan",
      description: "Execute accessibility tests",
    },
    {
      id: "results",
      label: "View Results",
      description: "Analyze findings and recommendations",
    },
  ]

  return (
    <StepIndicator
      steps={steps}
      currentStep={3}
      variant="vertical"
      size="lg"
    />
  )
}

// Example 5: Integration with React state
export function InteractiveExample() {
  const [currentStep, setCurrentStep] = React.useState(0)

  const steps = [
    { id: "start", label: "Start" },
    { id: "process", label: "Processing" },
    { id: "complete", label: "Complete" },
  ]

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="space-y-4">
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        variant="horizontal"
        size="md"
        allowNavigation
        onStepClick={setCurrentStep}
      />
      <div className="flex gap-2">
        <button
          onClick={previousStep}
          disabled={currentStep === 0}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={nextStep}
          disabled={currentStep === steps.length - 1}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
