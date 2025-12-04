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
  type: 'process' | 'db' | 'frp' | 'assert';
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

// Domain state types for show-database.txt
export type DomainProcess = {
  type: 'TE' | 'SM';
  address: string;
  port: number;
  startId: number;
  serverId: string;
  pid: number;
  nodeId: number;
  lastAck: number;
  status: string;
};

export type DomainServer = {
  serverId: string;
  address: string;
  port: number;
  lastAck: number;
  status: string;
  role: string;
  leader?: string;
  log?: string;
};

export type DomainDatabase = {
  name: string;
  state: string;
  processes: DomainProcess[];
};

export type DomainState = {
  serverVersion: string;
  serverLicense: string;
  serverTime: string;
  clientToken: string;
  servers: DomainServer[];
  databases: DomainDatabase[];
  raw: string;
};

export type DomainStateSnapshot = {
  timestamp: number;
  iso: string;
  state: DomainState;
};
