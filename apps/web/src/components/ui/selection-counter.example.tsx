/**
 * SelectionCounter Component Examples
 *
 * This file demonstrates various usage patterns for the SelectionCounter component.
 * NOT included in production build - for development reference only.
 */

import * as React from "react"
import { SelectionCounter } from "./selection-counter"

// Example 1: Basic usage with batch scan selection
export function BatchScanSelectionExample() {
  const [selectedUrls, setSelectedUrls] = React.useState<string[]>([
    "/home",
    "/about",
    "/contact",
  ])

  const totalUrls = [
    "/home",
    "/about",
    "/contact",
    "/products",
    "/services",
    "/blog",
    "/careers",
    "/privacy",
    "/terms",
    "/faq",
  ]

  const handleClearSelection = () => {
    setSelectedUrls([])
  }

  const handleSelectAll = () => {
    setSelectedUrls(totalUrls)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Select Pages for Batch Scan</h3>
      <div className="space-y-2">
        {totalUrls.map((url) => (
          <label key={url} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedUrls.includes(url)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUrls([...selectedUrls, url])
                } else {
                  setSelectedUrls(selectedUrls.filter((u) => u !== url))
                }
              }}
            />
            {url}
          </label>
        ))}
      </div>

      <SelectionCounter
        selectedCount={selectedUrls.length}
        totalCount={totalUrls.length}
        onClearSelection={handleClearSelection}
        onSelectAll={handleSelectAll}
      />
    </div>
  )
}

// Example 2: History item bulk deletion with sticky positioning
export function HistoryBulkDeleteExample() {
  const [selectedItems, setSelectedItems] = React.useState<number[]>([1, 3, 5])

  const historyItems = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    url: `https://example.com/page-${i}`,
    date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
  }))

  return (
    <div className="max-h-96 overflow-y-auto space-y-4">
      <h3 className="text-lg font-semibold sticky top-0 bg-white z-20 py-2">
        Scan History
      </h3>

      <div className="space-y-2">
        {historyItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 border rounded"
          >
            <input
              type="checkbox"
              checked={selectedItems.includes(item.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedItems([...selectedItems, item.id])
                } else {
                  setSelectedItems(selectedItems.filter((id) => id !== item.id))
                }
              }}
            />
            <div>
              <div className="font-medium">{item.url}</div>
              <div className="text-sm text-gray-500">{item.date}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky counter for mobile scrolling */}
      <SelectionCounter
        selectedCount={selectedItems.length}
        totalCount={historyItems.length}
        onClearSelection={() => setSelectedItems([])}
        onSelectAll={() => setSelectedItems(historyItems.map((item) => item.id))}
        sticky
      />
    </div>
  )
}

// Example 3: Simple usage without sticky positioning
export function SimpleSelectionExample() {
  const [selected, setSelected] = React.useState(3)

  return (
    <SelectionCounter
      selectedCount={selected}
      totalCount={10}
      onClearSelection={() => setSelected(0)}
      onSelectAll={() => setSelected(10)}
    />
  )
}

// Example 4: All items selected (no Select All button)
export function AllSelectedExample() {
  return (
    <SelectionCounter
      selectedCount={15}
      totalCount={15}
      onClearSelection={() => console.log("Clear all")}
      onSelectAll={() => console.log("Select all")}
    />
  )
}

// Example 5: Zero items selected (hidden state)
export function NoSelectionExample() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Selection counter is hidden when no items are selected
      </p>
      <SelectionCounter
        selectedCount={0}
        totalCount={25}
        onClearSelection={() => console.log("Clear")}
        onSelectAll={() => console.log("Select all")}
      />
    </div>
  )
}

// Example 6: Custom className for integration
export function CustomStyledExample() {
  return (
    <SelectionCounter
      selectedCount={7}
      totalCount={20}
      onClearSelection={() => console.log("Clear")}
      onSelectAll={() => console.log("Select all")}
      className="border-2 border-blue-500 shadow-lg"
    />
  )
}

// Example 7: Mobile-optimized with sticky positioning
export function MobileOptimizedExample() {
  const [selectedPages, setSelectedPages] = React.useState<string[]>([
    "Home",
    "About",
  ])

  const pages = [
    "Home",
    "About",
    "Services",
    "Products",
    "Blog",
    "Contact",
    "FAQ",
    "Privacy",
    "Terms",
    "Careers",
  ]

  return (
    <div className="max-w-sm mx-auto">
      <div className="h-96 overflow-y-auto border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Pages to Scan</h3>
        <div className="space-y-2 pb-20">
          {pages.map((page) => (
            <label key={page} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={selectedPages.includes(page)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPages([...selectedPages, page])
                  } else {
                    setSelectedPages(selectedPages.filter((p) => p !== page))
                  }
                }}
                className="h-4 w-4"
              />
              <span>{page}</span>
            </label>
          ))}
        </div>

        {/* Sticky at bottom for mobile scrolling */}
        <SelectionCounter
          selectedCount={selectedPages.length}
          totalCount={pages.length}
          onClearSelection={() => setSelectedPages([])}
          onSelectAll={() => setSelectedPages(pages)}
          sticky
        />
      </div>
    </div>
  )
}

// Example 8: Integration with API data
export function ApiIntegrationExample() {
  const [selectedIds, setSelectedIds] = React.useState<number[]>([1, 2, 3])

  // Simulated API data
  const discoveredUrls = React.useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        url: `https://example.com/page-${i + 1}`,
        title: `Page ${i + 1}`,
      })),
    []
  )

  const handleClear = () => {
    setSelectedIds([])
    console.log("Selection cleared")
  }

  const handleSelectAll = () => {
    setSelectedIds(discoveredUrls.map((url) => url.id))
    console.log(`Selected all ${discoveredUrls.length} URLs`)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        Discovered URLs ({discoveredUrls.length} total)
      </h3>

      <SelectionCounter
        selectedCount={selectedIds.length}
        totalCount={discoveredUrls.length}
        onClearSelection={handleClear}
        onSelectAll={handleSelectAll}
      />

      <div className="text-sm text-gray-500">
        Selected IDs: {selectedIds.join(", ") || "None"}
      </div>
    </div>
  )
}
