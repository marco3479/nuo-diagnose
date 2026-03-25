import { useState, type JSX } from 'react';
import type { EventType } from '../../types';
import { EventTimeline, LogPanelShell, PanelHeader, hasErrorLog, matchesLogLevel, type ViewMode } from './shared';
import type { SharedPanelProps } from './types';

type UnclassifiedPanelProps = SharedPanelProps & {
  unclassifiedEvents: EventType[];
  setSelectedUnclassified: (selected: boolean) => void;
  setSelectedAp: (ap: string | null) => void;
};

export function UnclassifiedPanel({
  unclassifiedEvents,
  setSelectedUnclassified,
  setSelectedAp,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  setPanelFocus,
  rangeStart,
  rangeEnd,
  logLevelFilter,
  setLogLevelFilter,
}: UnclassifiedPanelProps): JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('ui');

  let filteredEvents =
    rangeStart !== null && rangeEnd !== null
      ? unclassifiedEvents.filter((event) => event.ts >= rangeStart && event.ts <= rangeEnd)
      : unclassifiedEvents;

  if (logLevelFilter !== 'All levels') {
    filteredEvents = filteredEvents.filter((event) => matchesLogLevel(event, logLevelFilter));
  }

  return (
    <LogPanelShell
      header={
        <PanelHeader
          title="Logs - Unclassified"
          viewMode={viewMode}
          setViewMode={setViewMode}
          logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
          onClose={() => {
            setSelectedUnclassified(false);
            setSelectedAp(null);
          }}
        />
      }
      timeline={
        <EventTimeline
          events={filteredEvents}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          getTimestamp={(event) => event.ts}
          getTitle={(event) => event.iso}
          getRawLog={(event) => event.raw ?? event.message}
          getColor={(event, isSelected, hasError) => {
            if (isSelected) {
              return hasError ? '#ff7070' : '#b380ff';
            }
            return hasError ? '#ff5050' : '#9966ff';
          }}
          onSelect={(index) => {
            setFocusedEventIndex(index);
            setPanelFocus('events');
          }}
        />
      }
    >
      {viewMode === 'text'
        ? filteredEvents.map((event, index) => {
            const rawLog = event.raw ?? event.message;
            const hasError = hasErrorLog(rawLog);
            return (
              <div
                key={`${event.iso}-${index}`}
                className={`event-item${panelFocus === 'events' && focusedEventIndex === index ? ' focused' : ''}`}
                onClick={() => {
                  setFocusedEventIndex(index);
                  setPanelFocus('events');
                }}
                style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === index ? 'rgba(43, 157, 244, 0.15)' : hasError ? 'rgba(255, 80, 80, 0.08)' : undefined, borderLeft: hasError ? '3px solid rgba(255, 80, 80, 0.5)' : undefined, fontFamily: 'monospace', fontSize: 12 }}
              >
                <div style={{ color: hasError ? '#ffb3b3' : 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{rawLog}</div>
              </div>
            );
          })
        : filteredEvents.map((event, index) => {
            const rawLog = event.raw ?? event.message;
            const hasError = hasErrorLog(rawLog);
            return (
              <div
                key={`${event.iso}-${index}`}
                className={`event-item${panelFocus === 'events' && focusedEventIndex === index ? ' focused' : ''}`}
                onClick={() => {
                  setFocusedEventIndex(index);
                  setPanelFocus('events');
                }}
                style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === index ? 'rgba(43, 157, 244, 0.15)' : hasError ? 'rgba(255, 80, 80, 0.08)' : undefined, borderLeft: hasError ? '3px solid rgba(255, 80, 80, 0.5)' : undefined }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event.iso}</div>
                <div style={{ fontSize: 13, color: hasError ? '#ffb3b3' : 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{rawLog}</div>
              </div>
            );
          })}
    </LogPanelShell>
  );
}
