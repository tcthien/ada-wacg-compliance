import React from 'react';
import { Button } from '@/components/ui/button';

interface SelectAllControlsProps {
  onSelectAll: () => void;
  onDeselectAll: () => void;
  selectedCount: number;
  totalCount: number;
}

export const SelectAllControls: React.FC<SelectAllControlsProps> = ({
  onSelectAll,
  onDeselectAll,
  selectedCount,
  totalCount,
}) => {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const noneSelected = selectedCount === 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSelectAll}
          disabled={allSelected}
          aria-label={`Select all ${totalCount} URLs`}
        >
          Select All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDeselectAll}
          disabled={noneSelected}
          aria-label="Deselect all URLs"
        >
          Deselect All
        </Button>
      </div>
      <span className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
        {selectedCount} of {totalCount} selected
      </span>
    </div>
  );
};
