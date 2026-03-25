import { type JSX, type ReactNode } from 'react';
import type { PanelFocus } from '../../types';

export type ViewMode = 'ui' | 'text';

const LOG_LEVEL_OPTIONS = ['All levels', 'ERROR', 'WARN', 'INFO', 'DEBUG'];

export function matchesLogLevel(event: { raw?: string; message?: string }, logLevelFilter: string): boolean {
  if (logLevelFilter === 'All levels') {
    return true;
  }

  const rawLog = event.raw ?? event.message ?? '';
  const filterUpper = logLevelFilter.toUpperCase();
  const patterns = [
    new RegExp(`\\[${filterUpper}\\]`, 'i'),
    new RegExp(`${filterUpper}:`, 'i'),
    new RegExp(`\\s${filterUpper}\\s`, 'i'),
    new RegExp(`^${filterUpper}\\s`, 'i'),
  ];

  return patterns.some((pattern) => pattern.test(rawLog));
}

export function hasErrorLog(rawLog: string): boolean {
  return /ASSERT:|\*\*\* Stacktrace:/.test(rawLog);
}

export function PanelHeader({
  title,
  viewMode,
  setViewMode,
  logLevelFilter,
  setLogLevelFilter,
  onClose,
  marginBottom = 0,
}: {
  title: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  logLevelFilter: string;
  setLogLevelFilter: (level: string) => void;
  onClose: () => void;
  marginBottom?: number;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={logLevelFilter}
          onChange={(event) => setLogLevelFilter(event.target.value)}
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}
        >
          {LOG_LEVEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 4, padding: 2 }}>
          <button
            onClick={() => setViewMode('ui')}
            style={{ background: viewMode === 'ui' ? 'var(--button-bg)' : 'transparent', color: viewMode === 'ui' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', padding: '6px 10px', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="UI View"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="1" />
              <line x1="2" y1="6" x2="14" y2="6" />
              <line x1="6" y1="6" x2="6" y2="14" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('text')}
            style={{ background: viewMode === 'text' ? 'var(--button-bg)' : 'transparent', color: viewMode === 'text' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', padding: '6px 10px', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Text View"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="4" x2="13" y2="4" strokeLinecap="round" />
              <line x1="3" y1="8" x2="13" y2="8" strokeLinecap="round" />
              <line x1="3" y1="12" x2="10" y2="12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'var(--button-bg)', color: 'var(--text-muted)', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function EmptyLogSelection(): JSX.Element {
  return (
    <div style={{ marginTop: 16, background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: 6, padding: 8 }}>
      <div style={{ color: 'var(--text-hint)' }}>Click a row to see events</div>
    </div>
  );
}

export function EventTimeline<T>({
  events,
  panelFocus,
  focusedEventIndex,
  getTimestamp,
  getTitle,
  getRawLog,
  getColor,
  onSelect,
}: {
  events: T[];
  panelFocus: PanelFocus;
  focusedEventIndex: number;
  getTimestamp: (event: T) => number;
  getTitle: (event: T) => string;
  getRawLog: (event: T) => string;
  getColor: (event: T, isSelected: boolean, hasError: boolean) => string;
  onSelect: (index: number) => void;
}): JSX.Element | null {
  if (events.length === 0) {
    return null;
  }

  const timestamps = events.map(getTimestamp);
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const timelineWidth = 380;

  return (
    <div style={{ position: 'relative', height: 32, background: 'var(--timeline-event-bg)', borderRadius: 4, padding: '0 10px' }}>
      <div style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 2, background: 'rgba(159, 180, 201, 0.3)', transform: 'translateY(-50%)' }} />
      {events.map((event, index) => {
        const timestamp = getTimestamp(event);
        const position = maxTs > minTs ? ((timestamp - minTs) / (maxTs - minTs)) * timelineWidth : timelineWidth / 2;
        const isSelected = panelFocus === 'events' && focusedEventIndex === index;
        const rawLog = getRawLog(event);
        const hasError = hasErrorLog(rawLog);

        return (
          <div
            key={index}
            title={getTitle(event)}
            style={{ position: 'absolute', left: 10 + position, top: '50%', width: isSelected ? 12 : 8, height: isSelected ? 12 : 8, background: getColor(event, isSelected, hasError), transform: 'translateX(-50%) translateY(-50%) rotate(45deg)', cursor: 'pointer', border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)', zIndex: isSelected ? 10 : 1, transition: 'all 0.2s ease' }}
            onClick={() => {
              onSelect(index);
              window.setTimeout(() => {
                const element = document.querySelectorAll('.event-item')[index];
                if (element instanceof HTMLElement) {
                  element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
              }, 50);
            }}
          />
        );
      })}
    </div>
  );
}

export function FileSourceSeparator({ fileSource }: { fileSource: string }): JSX.Element {
  return (
    <div style={{ background: 'rgba(80, 200, 255, 0.08)', padding: '4px 8px', marginTop: 8, marginBottom: 4, borderLeft: '3px solid rgba(80, 200, 255, 0.4)', fontSize: 11, fontWeight: 600, color: 'rgba(80, 200, 255, 0.9)' }}>
      {fileSource}
    </div>
  );
}

export function LogPanelShell({
  header,
  timeline,
  children,
}: {
  header: ReactNode;
  timeline?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {header}
      {timeline}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{children}</div>
    </div>
  );
}
