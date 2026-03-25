export const NONE_SELECTED = '__NONE_SELECTED__';

export type FilterControlsProps = {
  filterType: string;
  setFilterType: (type: string) => void;
  filterServers: Set<string>;
  setFilterServers: (servers: Set<string>) => void;
  filterSids: Set<string>;
  setFilterSids: (sids: Set<string>) => void;
  typeOptions: string[];
  allServers: string[];
  allSids: string[];
  serverDropdownOpen: boolean;
  setServerDropdownOpen: (open: boolean) => void;
  sidDropdownOpen: boolean;
  setSidDropdownOpen: (open: boolean) => void;
};

export type FilterBarProps = FilterControlsProps & {
  globalStart: number;
  globalEnd: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  setRangeStart: (start: number | null) => void;
  setRangeEnd: (end: number | null) => void;
};

export type FilterControlsComponentProps = FilterControlsProps & {
  compact?: boolean;
};
