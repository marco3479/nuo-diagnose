import { useState, type JSX } from 'react';
import type { DbStates } from '../../types';
import {
  EventTimeline,
  FileSourceSeparator,
  LogPanelShell,
  PanelHeader,
  matchesLogLevel,
  type ViewMode,
} from './shared';
import type { DatabasePanelEvent, DbDiff, EnrichedEvent, SharedPanelProps } from './types';

type DatabasePanelProps = SharedPanelProps & {
  selectedDb: string;
  setSelectedDb: (db: string | null) => void;
  setSelectedAp: (ap: string | null) => void;
  dbStates: DbStates;
  databaseEvents: EnrichedEvent[];
};

function renderDbDiff(dbDiff: DbDiff | undefined): JSX.Element | null {
  if (!dbDiff) {
    return null;
  }

  const changedKeys = Object.keys({ ...dbDiff.from, ...dbDiff.to }).filter(
    (key) => dbDiff.from[key] !== dbDiff.to[key]
  );

  if (changedKeys.length === 0) {
    return (
      <div style={{ marginTop: 6, background: 'rgba(100, 100, 100, 0.15)', padding: '6px 8px', borderRadius: 4, borderLeft: '3px solid rgba(150, 150, 150, 0.4)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', fontStyle: 'italic' }}>
          No changes detected in database fields
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6, background: 'rgba(43, 157, 244, 0.08)', padding: '6px 8px', borderRadius: 4, borderLeft: '3px solid rgba(43, 157, 244, 0.4)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-hint)', marginBottom: 4 }}>CHANGES:</div>
      {changedKeys.map((key) => {
        const fromValue = dbDiff.from[key];
        const toValue = dbDiff.to[key];
        return (
          <div key={key} style={{ marginLeft: 8, fontSize: 11, marginTop: 2 }}>
            <span style={{ color: 'var(--text-hint)' }}>{key}=</span>
            {fromValue && (
              <span style={{ background: 'rgba(255, 80, 80, 0.2)', color: '#ffb3b3', padding: '1px 3px', borderRadius: 2, textDecoration: 'line-through' }}>
                {fromValue}
              </span>
            )}
            {fromValue && toValue && <span style={{ color: 'var(--text-hint)', margin: '0 4px' }}>→</span>}
            {toValue && (
              <span style={{ background: 'rgba(80, 255, 120, 0.2)', color: '#90ee90', padding: '1px 3px', borderRadius: 2 }}>
                {toValue}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DatabasePanel({
  selectedDb,
  setSelectedDb,
  setSelectedAp,
  dbStates,
  databaseEvents,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  setPanelFocus,
  rangeStart,
  rangeEnd,
  logLevelFilter,
  setLogLevelFilter,
}: DatabasePanelProps): JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('ui');

  const dbStateEvents = dbStates[selectedDb] ?? [];
  const dbSpecificEvents = databaseEvents.filter((event) => {
    const message = event.message ?? '';
    const raw = event.raw ?? '';
    return message.includes(selectedDb) || raw.includes(selectedDb);
  });

  const allDbEvents: DatabasePanelEvent[] = [
    ...dbStateEvents.map((segment) => {
      const matchingEvent = dbSpecificEvents.find(
        (event) => event.iso === segment.iso && (event.message === segment.message || event.raw?.includes(segment.message))
      );
      return {
        ...segment,
        start: segment.start,
        raw: matchingEvent?.raw,
        fileSource: matchingEvent?.fileSource,
        dbDiff: matchingEvent?.dbDiff,
      };
    }),
    ...dbSpecificEvents.map((event) => {
      const fullLog = event.raw ?? event.message;
      const isUpdate = /UpdateDatabaseOptionsCommand/.test(fullLog);
      return {
        start: event.ts,
        end: event.ts,
        iso: event.iso,
        state: isUpdate ? 'UpdateDatabaseOptionsCommand' : 'Database Event',
        message: fullLog,
        raw: event.raw,
        fileSource: event.fileSource,
        isUpdate,
        dbDiff: event.dbDiff,
      };
    }),
  ].sort((left, right) => left.start - right.start);

  let filteredDbEvents =
    rangeStart !== null && rangeEnd !== null
      ? allDbEvents.filter((event) => event.start >= rangeStart && event.start <= rangeEnd)
      : allDbEvents;

  if (logLevelFilter !== 'All levels') {
    filteredDbEvents = filteredDbEvents.filter((event) => matchesLogLevel(event, logLevelFilter));
  }

  const renderedEvents: JSX.Element[] = [];
  let lastFileSource: string | undefined;

  filteredDbEvents.forEach((event, index) => {
    if (event.fileSource && event.fileSource !== lastFileSource) {
      renderedEvents.push(<FileSourceSeparator key={`file-${event.fileSource}-${index}`} fileSource={event.fileSource} />);
      lastFileSource = event.fileSource;
    }

    const rawLog = event.raw ?? event.message;
    renderedEvents.push(
      <div
        key={`${event.iso}-${index}`}
        className={`event-item${panelFocus === 'events' && focusedEventIndex === index ? ' focused' : ''}`}
        onClick={() => {
          setFocusedEventIndex(index);
          setPanelFocus('events');
        }}
        style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === index ? 'rgba(43, 157, 244, 0.15)' : event.isUpdate ? 'rgba(280, 60%, 60%, 0.05)' : undefined, fontFamily: viewMode === 'text' ? 'monospace' : undefined, fontSize: viewMode === 'text' ? 12 : undefined }}
      >
        {viewMode === 'text' ? (
          <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{rawLog}</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event.iso}</div>
            <div style={{ fontSize: 13, color: event.isUpdate ? '#c9a6ff' : 'var(--text-primary)', fontWeight: 600 }}>{event.state}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{event.message}</div>
            {/Updated database from DatabaseInfo/.test(event.message) && renderDbDiff(event.dbDiff)}
          </>
        )}
      </div>
    );
  });

  return (
    <LogPanelShell
      header={
        <PanelHeader
          title={`Logs - Database ${selectedDb}`}
          viewMode={viewMode}
          setViewMode={setViewMode}
          logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
          onClose={() => {
            setSelectedDb(null);
            setSelectedAp(null);
          }}
        />
      }
      timeline={
        <EventTimeline
          events={filteredDbEvents}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          getTimestamp={(event) => event.start}
          getTitle={(event) => event.iso}
          getRawLog={(event) => event.raw ?? event.message}
          getColor={(_event, isSelected) => (isSelected ? '#43bdff' : '#2b9df4')}
          onSelect={(index) => {
            setFocusedEventIndex(index);
            setPanelFocus('events');
          }}
        />
      }
    >
      {renderedEvents}
    </LogPanelShell>
  );
}
