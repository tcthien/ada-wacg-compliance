"use client"

import * as React from "react"
import { ConfirmDialog } from "./confirm-dialog"
import { Button } from "./button"

/**
 * Example usage of ConfirmDialog component
 * This file demonstrates the three variants and loading state
 */
export function ConfirmDialogExamples() {
  const [dangerOpen, setDangerOpen] = React.useState(false)
  const [warningOpen, setWarningOpen] = React.useState(false)
  const [defaultOpen, setDefaultOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleAsyncConfirm = async () => {
    setIsLoading(true)
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsLoading(false)
    setDangerOpen(false)
  }

  return (
    <div className="space-y-4 p-8">
      <h2 className="text-2xl font-bold">ConfirmDialog Examples</h2>

      {/* Danger variant */}
      <div>
        <Button variant="destructive" onClick={() => setDangerOpen(true)}>
          Delete Items (Danger)
        </Button>
        <ConfirmDialog
          open={dangerOpen}
          onOpenChange={setDangerOpen}
          variant="danger"
          title="Delete Items"
          description="Are you sure you want to delete 5 items? This action cannot be undone."
          confirmLabel="Delete"
          isLoading={isLoading}
          onConfirm={handleAsyncConfirm}
        />
      </div>

      {/* Warning variant */}
      <div>
        <Button variant="outline" onClick={() => setWarningOpen(true)}>
          Clear History (Warning)
        </Button>
        <ConfirmDialog
          open={warningOpen}
          onOpenChange={setWarningOpen}
          variant="warning"
          title="Clear History"
          description="This will remove all scan history. You can always run new scans."
          confirmLabel="Clear"
          onConfirm={() => {
            console.log("History cleared")
            setWarningOpen(false)
          }}
        />
      </div>

      {/* Default variant */}
      <div>
        <Button onClick={() => setDefaultOpen(true)}>
          Confirm Action (Default)
        </Button>
        <ConfirmDialog
          open={defaultOpen}
          onOpenChange={setDefaultOpen}
          variant="default"
          title="Confirm Action"
          description="Are you sure you want to proceed with this action?"
          confirmLabel="Proceed"
          cancelLabel="Go Back"
          onConfirm={() => {
            console.log("Action confirmed")
            setDefaultOpen(false)
          }}
          onCancel={() => {
            console.log("Action cancelled")
            setDefaultOpen(false)
          }}
        />
      </div>
    </div>
  )
}
