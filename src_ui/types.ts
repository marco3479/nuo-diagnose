export type Instance = {
  process: string;
  sid: number;
  start: number;
  end: number;
  firstIso?: string;
  lastIso?: string;
  type?: string;
  address?: string;
};

export type DbSeg = {
  state: string;
  start: number;
  end: number;
  iso: string;
  message: string;
};

export type DbStates = Record<string, DbSeg[]>;

export type FailureProtocol = {
  dbName: string;
  sid: number;
  node: number;
  iteration: number;
  ts: number;
  iso: string;
  message: string;
  raw: string;
};

export type ServerTimeRange = {
  server: string;
  start: number;
  end: number;
  startIso: string;
  endIso: string;
};

export type EventType = {
  ts: number;
  iso: string;
  sid: number | null;
  message: string;
  raw?: string;
};

export type HoveredBar = {
  type: 'process' | 'db' | 'frp';
  id: string;
  content: string;
};

export type FocusedTimelineItem = {
  type: 'ap' | 'unclassified' | 'db' | 'sid';
  key: string;
  index: number;
};

export type TableRow =
  | { type: 'unclassified'; key: 'unclassified' }
  | { type: 'db'; key: string }
  | { type: 'instance'; key: string; instance: Instance };

export type LoadMode = 'file' | 'nuosupport';

export type Theme = 'dark' | 'light';

export type SortKey = 'sid' | 'type' | 'address' | 'start' | 'end';

export type SortDir = 'asc' | 'desc';

export type PanelFocus = 'timeline' | 'table' | 'events';
