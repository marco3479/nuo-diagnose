import { useState, type JSX } from 'react';
import type { EventType, FailureProtocol, Instance } from '../../types';
import {
  EventTimeline,
  FileSourceSeparator,
  LogPanelShell,
  PanelHeader,
  hasErrorLog,
  matchesLogLevel,
  type ViewMode,
} from './shared';
import type { DbDiff, EnrichedEvent, ProcessLogEvent, SharedPanelProps } from './types';

type ProcessPanelProps = SharedPanelProps & {
  selectedSid: number;
  setSelectedSid: (sid: number | null) => void;
  setSelectedAp: (ap: string | null) => void;
  events: EventType[];
  failureProtocols: FailureProtocol[];
  rowsBySid: Record<string, Instance[]>;
  loadedServer: string;
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
        <div style={{ fontSize: 11, color: 'var(--text-hint)', fontStyle: 'italic' }}>No changes detected in database fields</div>
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
            {fromValue && <span style={{ background: 'rgba(255, 80, 80, 0.2)', color: '#ffb3b3', padding: '1px 3px', borderRadius: 2, textDecoration: 'line-through' }}>{fromValue}</span>}
            {fromValue && toValue && <span style={{ color: 'var(--text-hint)', margin: '0 4px' }}>→</span>}
            {toValue && <span style={{ background: 'rgba(80, 255, 120, 0.2)', color: '#90ee90', padding: '1px 3px', borderRadius: 2 }}>{toValue}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function ProcessPanel({
  selectedSid,
  setSelectedSid,
  setSelectedAp,
  events,
  failureProtocols,
  rowsBySid,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  setPanelFocus,
  loadedServer,
  rangeStart,
  rangeEnd,
  logLevelFilter,
  setLogLevelFilter,
}: ProcessPanelProps): JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('ui');
  const instsForSid = rowsBySid[String(selectedSid)] ?? [];
  const enrichedEvents = events as EnrichedEvent[];

  const related = enrichedEvents.filter((event) => {
    if (event.sid === selectedSid) {
      return true;
    }
    if (event.sid === null && instsForSid.length > 0) {
      const message = event.message ?? '';
      const raw = event.raw ?? '';
      const isDatabaseEvent =
        /\bdbName[:=]/.test(message) ||
        /\bdbName[:=]/.test(raw) ||
        /Database incarnation change/.test(message) ||
        /Database incarnation change/.test(raw) ||
        /Updated database from DatabaseInfo/.test(message) ||
        /Updated database from DatabaseInfo/.test(raw);
      if (isDatabaseEvent) {
        return false;
      }
      return instsForSid.some((instance) => event.ts >= instance.start && event.ts <= instance.end);
    }
    return false;
  }).sort((left, right) => left.ts - right.ts);

  const frpForSid = failureProtocols.filter((protocol) => protocol.sid === selectedSid);
  const allEvents: ProcessLogEvent[] = [
    ...related.map((event) => ({ type: 'event' as const, ts: event.ts, iso: event.iso, message: event.message, raw: event.raw, fileSource: event.fileSource, dbDiff: event.dbDiff })),
    ...frpForSid.map((protocol) => ({ type: 'frp' as const, ts: protocol.ts, iso: protocol.iso, message: protocol.raw, raw: protocol.raw })),
  ].sort((left, right) => left.ts - right.ts);

  let filteredEvents =
    rangeStart !== null && rangeEnd !== null
      ? allEvents.filter((event) => event.ts >= rangeStart && event.ts <= rangeEnd)
      : allEvents;

  if (logLevelFilter !== 'All levels') {
    filteredEvents = filteredEvents.filter((event) => matchesLogLevel(event, logLevelFilter));
  }

  const renderedTextEvents: JSX.Element[] = [];
  const renderedUiEvents: JSX.Element[] = [];
  let lastFileSource: string | undefined;

  filteredEvents.forEach((event, index) => {
    if (loadedServer && event.fileSource && event.fileSource !== lastFileSource) {
      const separator = <FileSourceSeparator key={`file-${event.fileSource}-${index}`} fileSource={event.fileSource} />;
      renderedTextEvents.push(separator);
      renderedUiEvents.push(separator);
      lastFileSource = event.fileSource;
    }

    const rawLog = event.raw ?? event.message;
    const logMatch = rawLog.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+(\S+)\s+(.*)$/);
    const logLevel = logMatch?.[2] ?? '';
    const threadInfo = logMatch?.[3] ?? '';
    const loggerName = logMatch?.[4] ?? '';
    const logMessage = logMatch?.[5] ?? event.message;
    const isRemoveNode = /RemoveNodeCommand/.test(logMessage);
    const reasonMatch = isRemoveNode ? logMessage.match(/reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/) : null;
    const isGraceful = Boolean(reasonMatch) && /Gracefully shutdown engine/i.test(reasonMatch?.[0] ?? '');
    const hasAssertReason = Boolean(reasonMatch) && /ASSERT/i.test(reasonMatch?.[0] ?? '');
    const hasError = hasErrorLog(rawLog);
    const isDbUpdate = /Updated database from DatabaseInfo/.test(logMessage);

    const commonStyle = {
      padding: '6px 8px',
      borderBottom: '1px solid rgba(255,255,255,0.02)',
      cursor: 'pointer',
      background:
        panelFocus === 'events' && focusedEventIndex === index
          ? 'rgba(43, 157, 244, 0.15)'
          : event.type === 'frp'
          ? 'rgba(255, 80, 80, 0.05)'
          : hasError
          ? 'rgba(255, 80, 80, 0.08)'
          : undefined,
      borderLeft: hasError ? '3px solid rgba(255, 80, 80, 0.5)' : undefined,
    } as const;

    renderedTextEvents.push(
      <div
        key={`text-${event.iso}-${index}`}
        className={`event-item${panelFocus === 'events' && focusedEventIndex === index ? ' focused' : ''}`}
        onClick={() => {
          setFocusedEventIndex(index);
          setPanelFocus('events');
        }}
        style={{ ...commonStyle, fontFamily: 'monospace', fontSize: 12 }}
      >
        {event.type === 'frp' && <div style={{ fontSize: 11, fontWeight: 600, color: '#ff7070', background: 'rgba(255, 80, 80, 0.1)', padding: '2px 6px', borderRadius: 3, display: 'inline-block', marginBottom: 4 }}>FAILURE PROTOCOL</div>}
        <div style={{ color: hasError ? '#ffb3b3' : 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{rawLog}</div>
      </div>
    );

    renderedUiEvents.push(
      <div
        key={`ui-${event.iso}-${index}`}
        className={`event-item${panelFocus === 'events' && focusedEventIndex === index ? ' focused' : ''}`}
        onClick={() => {
          setFocusedEventIndex(index);
          setPanelFocus('events');
        }}
        style={commonStyle}
      >
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event.iso}</div>
        {event.type === 'frp' && <div style={{ fontSize: 11, fontWeight: 600, color: '#ff7070', background: 'rgba(255, 80, 80, 0.1)', padding: '2px 6px', borderRadius: 3, display: 'inline-block', marginBottom: 4 }}>FAILURE PROTOCOL</div>}
        <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
          {logMatch ? (
            <div>
              <span style={{ color: logLevel === 'ERROR' ? '#ff6666' : logLevel === 'WARN' ? '#ffaa66' : 'var(--text-hint)', fontWeight: logLevel === 'ERROR' || logLevel === 'WARN' ? 600 : 400 }}>{logLevel}</span>
              <span style={{ color: 'var(--text-hint)', margin: '0 6px' }}>|</span>
              <span style={{ color: 'var(--text-hint)', fontSize: 11 }}>[{threadInfo}]</span>
              <span style={{ color: 'var(--text-hint)', margin: '0 6px' }}>|</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{loggerName}</span>
              <div style={{ marginTop: 4, color: hasError ? '#ffb3b3' : 'var(--text-primary)' }}>
                {isDbUpdate && event.dbDiff ? (
                  <div>
                    {logMessage}
                    {renderDbDiff(event.dbDiff)}
                  </div>
                ) : isRemoveNode && reasonMatch ? (
                  <>
                    {logMessage.substring(0, reasonMatch.index ?? 0)}
                    <span style={{ background: hasAssertReason ? 'rgba(255, 0, 0, 0.3)' : isGraceful ? 'rgba(255, 200, 100, 0.2)' : 'rgba(255, 80, 80, 0.2)', color: hasAssertReason ? '#ff6666' : isGraceful ? '#ffdd99' : '#ffb3b3', padding: '2px 4px', borderRadius: 3, fontWeight: 600, boxShadow: hasAssertReason ? '0 0 4px rgba(255, 0, 0, 0.4)' : 'none' }}>
                      {reasonMatch[0]}
                    </span>
                    {logMessage.substring((reasonMatch.index ?? 0) + reasonMatch[0].length)}
                  </>
                ) : (
                  logMessage
                )}
              </div>
            </div>
          ) : (
            rawLog
          )}
        </div>
      </div>
    );
  });

  return (
    <LogPanelShell
      header={
        <PanelHeader
          title={`Logs - sid ${selectedSid}`}
          viewMode={viewMode}
          setViewMode={setViewMode}
          logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
          onClose={() => {
            setSelectedSid(null);
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
              return hasError || event.type === 'frp' ? '#ff7070' : '#43bdff';
            }
            return hasError || event.type === 'frp' ? '#ff5050' : '#2b9df4';
          }}
          onSelect={(index) => {
            setFocusedEventIndex(index);
            setPanelFocus('events');
          }}
        />
      }
    >
      {viewMode === 'text' ? renderedTextEvents : renderedUiEvents}
    </LogPanelShell>
  );
}
