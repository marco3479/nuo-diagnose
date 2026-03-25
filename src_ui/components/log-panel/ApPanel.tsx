import { useState, type JSX } from 'react';
import { EventTimeline, FileSourceSeparator, LogPanelShell, PanelHeader, hasErrorLog, matchesLogLevel, type ViewMode } from './shared';
import type { EnrichedEvent, SharedPanelProps } from './types';

type ApPanelProps = SharedPanelProps & {
  selectedAp: string;
  setSelectedAp: (ap: string | null) => void;
  processEvents: EnrichedEvent[];
};

export function ApPanel({
  selectedAp,
  setSelectedAp,
  processEvents,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  setPanelFocus,
  rangeStart,
  rangeEnd,
  logLevelFilter,
  setLogLevelFilter,
}: ApPanelProps): JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('ui');
  const apEvents = processEvents.filter((event) => event.sid === null);

  let filteredEvents =
    rangeStart !== null && rangeEnd !== null
      ? apEvents.filter((event) => event.ts >= rangeStart && event.ts <= rangeEnd)
      : apEvents;

  if (logLevelFilter !== 'All levels') {
    filteredEvents = filteredEvents.filter((event) => matchesLogLevel(event, logLevelFilter));
  }

  const renderedElements: JSX.Element[] = [];
  let lastFileSource: string | undefined;

  filteredEvents.forEach((event, index) => {
    if (event.fileSource && event.fileSource !== lastFileSource) {
      renderedElements.push(<FileSourceSeparator key={`file-${event.fileSource}-${index}`} fileSource={event.fileSource} />);
      lastFileSource = event.fileSource;
    }

    const rawLog = event.raw ?? event.message;
    const logMatch = rawLog.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+(\S+)\s+(.*)$/);
    const hasError = hasErrorLog(rawLog);
    const logLevel = logMatch?.[2] ?? '';
    const threadInfo = logMatch?.[3] ?? '';
    const loggerName = logMatch?.[4] ?? '';
    const logMessage = logMatch?.[5] ?? event.message;

    renderedElements.push(
      <div
        key={`${event.iso}-${index}`}
        className={`event-item${panelFocus === 'events' && focusedEventIndex === index ? ' focused' : ''}`}
        onClick={() => {
          setFocusedEventIndex(index);
          setPanelFocus('events');
        }}
        style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === index ? 'rgba(43, 157, 244, 0.15)' : hasError ? 'rgba(255, 80, 80, 0.08)' : undefined, borderLeft: hasError ? '3px solid rgba(255, 80, 80, 0.5)' : undefined, fontFamily: viewMode === 'text' ? 'monospace' : undefined, fontSize: viewMode === 'text' ? 12 : undefined }}
      >
        {viewMode === 'text' ? (
          <div style={{ color: hasError ? '#ffb3b3' : 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{rawLog}</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event.iso}</div>
            <div style={{ fontSize: 13, color: hasError ? '#ffb3b3' : 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {logMatch ? (
                <div>
                  <span style={{ color: logLevel === 'ERROR' ? '#ff6666' : logLevel === 'WARN' ? '#ffaa66' : 'var(--text-hint)', fontWeight: logLevel === 'ERROR' || logLevel === 'WARN' ? 600 : 400 }}>{logLevel}</span>
                  <span style={{ color: 'var(--text-hint)', margin: '0 6px' }}>|</span>
                  <span style={{ color: 'var(--text-hint)', fontSize: 11 }}>[{threadInfo}]</span>
                  <span style={{ color: 'var(--text-hint)', margin: '0 6px' }}>|</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{loggerName}</span>
                  <div style={{ marginTop: 4, color: 'var(--text-primary)' }}>{logMessage}</div>
                </div>
              ) : (
                rawLog
              )}
            </div>
          </>
        )}
      </div>
    );
  });

  return (
    <LogPanelShell
      header={
        <PanelHeader
          title={selectedAp || 'Admin Process Events'}
          viewMode={viewMode}
          setViewMode={setViewMode}
          logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
          onClose={() => setSelectedAp(null)}
          marginBottom={8}
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
          getColor={(_event, isSelected, hasError) => {
            if (isSelected) {
              return hasError ? '#ff7070' : '#43bdff';
            }
            return hasError ? '#ff5050' : '#2b9df4';
          }}
          onSelect={(index) => {
            setFocusedEventIndex(index);
            setPanelFocus('events');
          }}
        />
      }
    >
      {renderedElements}
    </LogPanelShell>
  );
}
