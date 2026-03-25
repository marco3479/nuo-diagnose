import type { JSX } from 'react';
import { FilterControls } from './filter-bar/FilterControls';
import { TimeRangeControls } from './filter-bar/TimeRangeControls';
import type { FilterBarProps } from './filter-bar/types';

export type { FilterControlsProps, FilterBarProps } from './filter-bar/types';
export { FilterControls } from './filter-bar/FilterControls';

export function FilterBar({
  globalStart,
  globalEnd,
  rangeStart,
  rangeEnd,
  setRangeStart,
  setRangeEnd,
}: FilterBarProps): JSX.Element {
  return (
    <TimeRangeControls
      globalStart={globalStart}
      globalEnd={globalEnd}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      setRangeStart={setRangeStart}
      setRangeEnd={setRangeEnd}
    />
  );
}
