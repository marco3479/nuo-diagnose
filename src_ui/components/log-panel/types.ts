import type {
  DbSeg,
  DbStates,
  EventType,
  FailureProtocol,
  Instance,
  PanelFocus,
} from '../../types';

export type DbDiff = {
  from: Record<string, string | undefined>;
  to: Record<string, string | undefined>;
};

export type EnrichedEvent = EventType & {
  fileSource?: string;
  dbDiff?: DbDiff;
};

export type DatabasePanelEvent = DbSeg & {
  start: number;
  raw?: string;
  fileSource?: string;
  isUpdate?: boolean;
  dbDiff?: DbDiff;
};

export type ProcessLogEvent = {
  type: 'event' | 'frp';
  ts: number;
  iso: string;
  message: string;
  raw?: string;
  fileSource?: string;
  dbDiff?: DbDiff;
};

export type SharedPanelProps = {
  panelFocus: PanelFocus;
  focusedEventIndex: number;
  setFocusedEventIndex: (index: number) => void;
  setPanelFocus: (focus: PanelFocus) => void;
  rangeStart: number | null;
  rangeEnd: number | null;
  logLevelFilter: string;
  setLogLevelFilter: (level: string) => void;
};

export type LogPanelProps = {
  selectedSid: number | null;
  selectedDb: string | null;
  selectedAp: string | null;
  selectedUnclassified: boolean;
  setSelectedSid: (sid: number | null) => void;
  setSelectedDb: (db: string | null) => void;
  setSelectedAp: (ap: string | null) => void;
  setSelectedUnclassified: (selected: boolean) => void;
  unclassifiedEvents: EventType[];
  databaseEvents: EventType[];
  processEvents: EventType[];
  events: EventType[];
  dbStates: DbStates;
  failureProtocols: FailureProtocol[];
  rowsBySid: Record<string, Instance[]>;
  loadedServer: string;
} & SharedPanelProps;
