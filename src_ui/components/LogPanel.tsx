import type { Instance, EventType, FailureProtocol, DbStates } from '../types';

type LogPanelProps = {
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
  panelFocus: 'timeline' | 'table' | 'events';
  focusedEventIndex: number;
  setFocusedEventIndex: (index: number) => void;
  setPanelFocus: (focus: 'timeline' | 'table' | 'events') => void;
  loadedServer: string;
  rangeStart: number | null;
  rangeEnd: number | null;
};

declare const document: any;

export function LogPanel({
  selectedSid,
  selectedDb,
  selectedAp,
  selectedUnclassified,
  setSelectedSid,
  setSelectedDb,
  setSelectedAp,
  setSelectedUnclassified,
  unclassifiedEvents,
  databaseEvents,
  processEvents,
  events,
  dbStates,
  failureProtocols,
  rowsBySid,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  setPanelFocus,
  loadedServer,
  rangeStart,
  rangeEnd,
}: LogPanelProps) {
  if (selectedSid === null && selectedDb === null && selectedAp === null && !selectedUnclassified) {
    return (
      <div
        style={{
          marginTop: 16,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 6,
          padding: 8,
        }}
      >
        <div style={{ color: 'var(--text-hint)' }}>Click a row to see events</div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 16,
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-secondary)',
        borderRadius: 6,
        padding: 8,
      }}
    >
      {selectedUnclassified ? (
        <UnclassifiedPanel
          unclassifiedEvents={unclassifiedEvents}
          setSelectedUnclassified={setSelectedUnclassified}
          setSelectedAp={setSelectedAp}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          setPanelFocus={setPanelFocus}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
        />
      ) : selectedDb !== null ? (
        <DatabasePanel
          selectedDb={selectedDb}
          setSelectedDb={setSelectedDb}
          setSelectedAp={setSelectedAp}
          dbStates={dbStates}
          databaseEvents={databaseEvents}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          setPanelFocus={setPanelFocus}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
        />
      ) : selectedAp !== null ? (
        <ApPanel
          selectedAp={selectedAp}
          setSelectedAp={setSelectedAp}
          setSelectedSid={setSelectedSid}
          setSelectedDb={setSelectedDb}
          setSelectedUnclassified={setSelectedUnclassified}
          processEvents={processEvents}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          setPanelFocus={setPanelFocus}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
        />
      ) : (
        <ProcessPanel
          selectedSid={selectedSid}
          setSelectedSid={setSelectedSid}
          setSelectedAp={setSelectedAp}
          events={events}
          failureProtocols={failureProtocols}
          rowsBySid={rowsBySid}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          setPanelFocus={setPanelFocus}
          loadedServer={loadedServer}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
        />
      )}
    </div>
  );
}

function UnclassifiedPanel({
  unclassifiedEvents,
  setSelectedUnclassified,
  setSelectedAp,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  setPanelFocus,
  rangeStart,
  rangeEnd,
}: any) {
  // Filter events by time range
  const filteredEvents = rangeStart !== null && rangeEnd !== null
    ? unclassifiedEvents.filter((e: any) => e.ts >= rangeStart && e.ts <= rangeEnd)
    : unclassifiedEvents;

  const eventTimeline = (() => {
    if (filteredEvents.length === 0) return null;

    const minTs = Math.min(...unclassifiedEvents.map((e: any) => e.ts));
    const maxTs = Math.max(...unclassifiedEvents.map((e: any) => e.ts));
    const timelineWidth = 380;

    return (
      <div style={{ marginBottom: 12, padding: '8px 0' }}>
        <div
          style={{
            position: 'relative',
            height: 32,
            background: 'var(--timeline-event-bg)',
            borderRadius: 4,
            padding: '0 10px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: '50%',
              height: 2,
              background: 'rgba(159, 180, 201, 0.3)',
              transform: 'translateY(-50%)',
            }}
          />
          {unclassifiedEvents.map((ev: any, idx: number) => {
            const pos =
              maxTs > minTs ? ((ev.ts - minTs) / (maxTs - minTs)) * timelineWidth : timelineWidth / 2;
            const isSelected = panelFocus === 'events' && focusedEventIndex === idx;
            return (
              <div
                key={idx}
                title={ev.iso}
                style={{
                  position: 'absolute',
                  left: 10 + pos,
                  top: '50%',
                  width: isSelected ? 12 : 8,
                  height: isSelected ? 12 : 8,
                  background: isSelected ? '#b380ff' : '#9966ff',
                  transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                  zIndex: isSelected ? 10 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setFocusedEventIndex(idx);
                  setPanelFocus('events');
                  setTimeout(() => {
                    const elem = document.querySelectorAll('.event-item')[idx];
                    if (elem) elem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  }, 50);
                }}
              />
            );
          })}
        </div>
      </div>
    );
  })();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>Logs - Unclassified</div>
        <button
          onClick={() => {
            setSelectedUnclassified(false);
            setSelectedAp(null);
          }}
          style={{
            background: 'var(--button-bg)',
            color: 'var(--text-muted)',
            border: 'none',
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
      {eventTimeline}
      <div style={{ maxHeight: 480, overflow: 'auto' }}>
        {filteredEvents.map((ev: any, idx: number) => (
          <div
            key={idx}
            className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`}
            onClick={() => {
              setFocusedEventIndex(idx);
              setPanelFocus('events');
            }}
            style={{
              padding: '6px 8px',
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              cursor: 'pointer',
              background:
                panelFocus === 'events' && focusedEventIndex === idx
                  ? 'rgba(43, 157, 244, 0.15)'
                  : undefined,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.iso}</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {ev.raw ?? ev.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatabasePanel({
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
}: any) {
  const dbStateEvents = dbStates[selectedDb] || [];
  const dbSpecificEvents = databaseEvents.filter((e: any) => {
    const msg = e.message ?? '';
    const raw = e.raw ?? '';
    return msg.includes(selectedDb) || raw.includes(selectedDb);
  });

  const allDbEvents = [
    ...dbStateEvents.map((seg: any) => {
      const matchingEvent = databaseEvents.find(
        (e: any) => e.iso === seg.iso && e.message === seg.message
      );
      return {
        ...seg,
        dbDiff: matchingEvent ? (matchingEvent as any).dbDiff : undefined,
      };
    }),
    ...dbSpecificEvents.map((e) => {
      const fullLog = e.raw ?? e.message;
      const isUpdateDbCmd = /UpdateDatabaseOptionsCommand/.test(fullLog);
      const state = isUpdateDbCmd ? 'UpdateDatabaseOptionsCommand' : 'Database Event';
      return {
        start: e.ts,
        iso: e.iso,
        state: state,
        message: fullLog,
        isUpdate: isUpdateDbCmd,
        dbDiff: (e as any).dbDiff,
      };
    }),
  ];
  allDbEvents.sort((a, b) => a.start - b.start);

  // Filter events by time range
  const filteredDbEvents = rangeStart !== null && rangeEnd !== null
    ? allDbEvents.filter((e: any) => e.start >= rangeStart && e.start <= rangeEnd)
    : allDbEvents;

  const eventTimeline = (() => {
    if (filteredDbEvents.length === 0) return null;

    const minTs = Math.min(...filteredDbEvents.map((e: any) => e.start));
    const maxTs = Math.max(...filteredDbEvents.map((e: any) => e.start));
    const timelineWidth = 380;

    return (
      <div style={{ marginBottom: 12, padding: '8px 0' }}>
        <div
          style={{
            position: 'relative',
            height: 32,
            background: 'var(--timeline-event-bg)',
            borderRadius: 4,
            padding: '0 10px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: '50%',
              height: 2,
              background: 'rgba(159, 180, 201, 0.3)',
              transform: 'translateY(-50%)',
            }}
          />
          {filteredDbEvents.map((seg: any, idx: number) => {
            const pos =
              maxTs > minTs
                ? ((seg.start - minTs) / (maxTs - minTs)) * timelineWidth
                : timelineWidth / 2;
            const isSelected = panelFocus === 'events' && focusedEventIndex === idx;
            return (
              <div
                key={idx}
                title={seg.iso}
                style={{
                  position: 'absolute',
                  left: 10 + pos,
                  top: '50%',
                  width: isSelected ? 12 : 8,
                  height: isSelected ? 12 : 8,
                  background: isSelected ? '#43bdff' : '#2b9df4',
                  transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                  zIndex: isSelected ? 10 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setFocusedEventIndex(idx);
                  setPanelFocus('events');
                  setTimeout(() => {
                    const elem = document.querySelectorAll('.event-item')[idx];
                    if (elem) elem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  }, 50);
                }}
              />
            );
          })}
        </div>
      </div>
    );
  })();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>Logs - Database {selectedDb}</div>
        <button
          onClick={() => {
            setSelectedDb(null);
            setSelectedAp(null);
          }}
          style={{
            background: 'var(--button-bg)',
            color: 'var(--text-muted)',
            border: 'none',
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
      {eventTimeline}
      <div style={{ maxHeight: 480, overflow: 'auto' }}>
        {filteredDbEvents.map((seg: any, idx) => {
          const isDbUpdate = /Updated database from DatabaseInfo/.test(seg.message);
          return (
            <div
              key={idx}
              className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`}
              onClick={() => {
                setFocusedEventIndex(idx);
                setPanelFocus('events');
              }}
              style={{
                padding: '6px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                cursor: 'pointer',
                background:
                  panelFocus === 'events' && focusedEventIndex === idx
                    ? 'rgba(43, 157, 244, 0.15)'
                    : seg.isUpdate
                    ? 'rgba(280, 60%, 60%, 0.05)'
                    : undefined,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{seg.iso}</div>
              <div
                style={{
                  fontSize: 13,
                  color: seg.isUpdate ? '#c9a6ff' : 'var(--text-primary)',
                  fontWeight: 600,
                }}
              >
                {seg.state}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  marginTop: 2,
                }}
              >
                {seg.message}
              </div>
              {isDbUpdate &&
                seg.dbDiff &&
                (() => {
                  const changedKeys = Object.keys({ ...seg.dbDiff.from, ...seg.dbDiff.to }).filter(
                    (key: string) => {
                      return seg.dbDiff.from[key] !== seg.dbDiff.to[key];
                    }
                  );

                  if (changedKeys.length === 0) {
                    return (
                      <div
                        style={{
                          marginTop: 6,
                          background: 'rgba(100, 100, 100, 0.15)',
                          padding: '6px 8px',
                          borderRadius: 4,
                          borderLeft: '3px solid rgba(150, 150, 150, 0.4)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-hint)',
                            fontStyle: 'italic',
                          }}
                        >
                          No changes detected in database fields
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      style={{
                        marginTop: 6,
                        background: 'rgba(43, 157, 244, 0.08)',
                        padding: '6px 8px',
                        borderRadius: 4,
                        borderLeft: '3px solid rgba(43, 157, 244, 0.4)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text-hint)',
                          marginBottom: 4,
                        }}
                      >
                        CHANGES:
                      </div>
                      {Object.keys({ ...seg.dbDiff.from, ...seg.dbDiff.to }).map((key: string) => {
                        const fromVal = seg.dbDiff.from[key];
                        const toVal = seg.dbDiff.to[key];
                        const changed = fromVal !== toVal;
                        if (!changed) return null;
                        return (
                          <div key={key} style={{ marginLeft: 8, fontSize: 11, marginTop: 2 }}>
                            <span style={{ color: 'var(--text-hint)' }}>{key}=</span>
                            {fromVal && (
                              <span
                                style={{
                                  background: 'rgba(255, 80, 80, 0.2)',
                                  color: '#ffb3b3',
                                  padding: '1px 3px',
                                  borderRadius: 2,
                                  textDecoration: 'line-through',
                                }}
                              >
                                {fromVal}
                              </span>
                            )}
                            {fromVal && toVal && (
                              <span style={{ color: 'var(--text-hint)', margin: '0 4px' }}>
                                →
                              </span>
                            )}
                            {toVal && (
                              <span
                                style={{
                                  background: 'rgba(80, 255, 120, 0.2)',
                                  color: '#90ee90',
                                  padding: '1px 3px',
                                  borderRadius: 2,
                                }}
                              >
                                {toVal}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProcessPanel({
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
}: any) {
  const instsForSid = rowsBySid[String(selectedSid)] || [];
  const related = events.filter((e: any) => {
    if (e.sid === selectedSid) return true;
    if (e.sid === null && instsForSid.length > 0) {
      const msg = e.message ?? '';
      const raw = e.raw ?? '';
      const isDatabaseEvent =
        /\bdbName[:=]/.test(msg) ||
        /\bdbName[:=]/.test(raw) ||
        /Database incarnation change/.test(msg) ||
        /Database incarnation change/.test(raw) ||
        /Updated database from DatabaseInfo/.test(msg) ||
        /Updated database from DatabaseInfo/.test(raw);
      if (isDatabaseEvent) return false;
      return instsForSid.some((inst) => e.ts >= inst.start && e.ts <= inst.end);
    }
    return false;
  });
  related.sort((a, b) => a.ts - b.ts);

  const frpForSid = failureProtocols.filter((frp) => frp.sid === selectedSid);
  const allEvents = [
    ...related.map((ev) => ({
      type: 'event',
      ts: ev.ts,
      iso: ev.iso,
      message: ev.message,
      raw: ev.raw,
      fileSource: (ev as any).fileSource,
      dbDiff: (ev as any).dbDiff,
    })),
    ...frpForSid.map((frp) => ({
      type: 'frp',
      ts: frp.ts,
      iso: frp.iso,
      message: frp.raw,
      raw: frp.raw,
      fileSource: undefined as string | undefined,
      dbDiff: undefined,
    })),
  ];
  allEvents.sort((a, b) => a.ts - b.ts);

  // Filter events by time range
  const filteredEvents = rangeStart !== null && rangeEnd !== null
    ? allEvents.filter((e) => e.ts >= rangeStart && e.ts <= rangeEnd)
    : allEvents;

  const eventTimeline = (() => {
    if (filteredEvents.length === 0) return null;

    const minTs = Math.min(...filteredEvents.map((e) => e.ts));
    const maxTs = Math.max(...filteredEvents.map((e) => e.ts));
    const timelineWidth = 380;

    return (
      <div style={{ marginBottom: 12, padding: '8px 0' }}>
        <div
          style={{
            position: 'relative',
            height: 32,
            background: 'var(--timeline-event-bg)',
            borderRadius: 4,
            padding: '0 10px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: '50%',
              height: 2,
              background: 'rgba(159, 180, 201, 0.3)',
              transform: 'translateY(-50%)',
            }}
          />
          {filteredEvents.map((ev, idx) => {
            const pos =
              maxTs > minTs ? ((ev.ts - minTs) / (maxTs - minTs)) * timelineWidth : timelineWidth / 2;
            const isSelected = panelFocus === 'events' && focusedEventIndex === idx;
            return (
              <div
                key={idx}
                title={ev.iso}
                style={{
                  position: 'absolute',
                  left: 10 + pos,
                  top: '50%',
                  width: isSelected ? 12 : 8,
                  height: isSelected ? 12 : 8,
                  background: isSelected
                    ? ev.type === 'frp'
                      ? '#ff7070'
                      : '#43bdff'
                    : ev.type === 'frp'
                    ? '#ff5050'
                    : '#2b9df4',
                  transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                  zIndex: isSelected ? 10 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setFocusedEventIndex(idx);
                  setPanelFocus('events');
                  setTimeout(() => {
                    const elem = document.querySelectorAll('.event-item')[idx];
                    if (elem) elem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  }, 50);
                }}
              />
            );
          })}
        </div>
      </div>
    );
  })();

  let lastFileSource: string | undefined = undefined;
  const elements: JSX.Element[] = [];

  filteredEvents.forEach((ev, idx) => {
    if (loadedServer && ev.fileSource && ev.fileSource !== lastFileSource) {
      elements.push(
        <div
          key={`filesep-${idx}`}
          style={{
            background: 'rgba(80, 200, 255, 0.08)',
            padding: '4px 8px',
            marginTop: 8,
            marginBottom: 4,
            borderLeft: '3px solid rgba(80, 200, 255, 0.4)',
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(80, 200, 255, 0.9)',
          }}
        >
          {ev.fileSource}
        </div>
      );
      lastFileSource = ev.fileSource;
    }

    const rawLog = (ev as any).raw || ev.message;
    const logMatch = rawLog.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+(\S+)\s+(.*)$/);
    let logLevel = '';
    let threadInfo = '';
    let loggerName = '';
    let logMessage = ev.message;

    if (logMatch) {
      logLevel = logMatch[2];
      threadInfo = logMatch[3];
      loggerName = logMatch[4];
      logMessage = logMatch[5];
    }

    const isRemoveNode = /RemoveNodeCommand/.test(logMessage);
    const reasonMatch = isRemoveNode
      ? logMessage.match(/reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/)
      : null;
    const isGraceful = reasonMatch && /Gracefully shutdown engine/i.test(reasonMatch[0]);
    const hasAssert = reasonMatch && /ASSERT/i.test(reasonMatch[0]);

    const isDbUpdate = /Updated database from DatabaseInfo/.test(logMessage);
    const dbDiff = (ev as any).dbDiff;

    elements.push(
      <div
        key={idx}
        className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`}
        onClick={() => {
          setFocusedEventIndex(idx);
          setPanelFocus('events');
        }}
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.02)',
          cursor: 'pointer',
          background:
            panelFocus === 'events' && focusedEventIndex === idx
              ? 'rgba(43, 157, 244, 0.15)'
              : ev.type === 'frp'
              ? 'rgba(255, 80, 80, 0.05)'
              : undefined,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.iso}</div>
        {ev.type === 'frp' && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#ff7070',
              background: 'rgba(255, 80, 80, 0.1)',
              padding: '2px 6px',
              borderRadius: 3,
              display: 'inline-block',
              marginBottom: 4,
            }}
          >
            FAILURE PROTOCOL
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
          {logMatch ? (
            <div>
              <span
                style={{
                  color:
                    logLevel === 'ERROR'
                      ? '#ff6666'
                      : logLevel === 'WARN'
                      ? '#ffaa66'
                      : 'var(--text-hint)',
                  fontWeight: logLevel === 'ERROR' || logLevel === 'WARN' ? 600 : 400,
                }}
              >
                {logLevel}
              </span>
              <span style={{ color: 'var(--text-hint)', margin: '0 6px' }}>|</span>
              <span style={{ color: 'var(--text-hint)', fontSize: 11 }}>[{threadInfo}]</span>
              <span style={{ color: 'var(--text-hint)', margin: '0 6px' }}>|</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                {loggerName}
              </span>
              <div style={{ marginTop: 4, color: 'var(--text-primary)' }}>
                {isDbUpdate && dbDiff ? (
                  <div>
                    {logMessage}
                    {(() => {
                      const changedKeys = Object.keys({
                        ...dbDiff.from,
                        ...dbDiff.to,
                      }).filter((key: string) => {
                        return dbDiff.from[key] !== dbDiff.to[key];
                      });

                      if (changedKeys.length === 0) {
                        return (
                          <div
                            style={{
                              marginTop: 6,
                              background: 'rgba(100, 100, 100, 0.15)',
                              padding: '6px 8px',
                              borderRadius: 4,
                              borderLeft: '3px solid rgba(150, 150, 150, 0.4)',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-hint)',
                                fontStyle: 'italic',
                              }}
                            >
                              No changes detected in database fields
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          style={{
                            marginTop: 6,
                            background: 'rgba(43, 157, 244, 0.08)',
                            padding: '6px 8px',
                            borderRadius: 4,
                            borderLeft: '3px solid rgba(43, 157, 244, 0.4)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--text-hint)',
                              marginBottom: 4,
                            }}
                          >
                            CHANGES:
                          </div>
                          {Object.keys({ ...dbDiff.from, ...dbDiff.to }).map((key: string) => {
                            const fromVal = dbDiff.from[key];
                            const toVal = dbDiff.to[key];
                            const changed = fromVal !== toVal;
                            if (!changed) return null;
                            return (
                              <div
                                key={key}
                                style={{ marginLeft: 8, fontSize: 11, marginTop: 2 }}
                              >
                                <span style={{ color: 'var(--text-hint)' }}>{key}=</span>
                                {fromVal && (
                                  <span
                                    style={{
                                      background: 'rgba(255, 80, 80, 0.2)',
                                      color: '#ffb3b3',
                                      padding: '1px 3px',
                                      borderRadius: 2,
                                      textDecoration: 'line-through',
                                    }}
                                  >
                                    {fromVal}
                                  </span>
                                )}
                                {fromVal && toVal && (
                                  <span style={{ color: 'var(--text-hint)', margin: '0 4px' }}>
                                    →
                                  </span>
                                )}
                                {toVal && (
                                  <span
                                    style={{
                                      background: 'rgba(80, 255, 120, 0.2)',
                                      color: '#90ee90',
                                      padding: '1px 3px',
                                      borderRadius: 2,
                                    }}
                                  >
                                    {toVal}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : isRemoveNode && reasonMatch ? (
                  <>
                    {logMessage.substring(0, reasonMatch.index)}
                    <span
                      style={{
                        background: hasAssert
                          ? 'rgba(255, 0, 0, 0.3)'
                          : isGraceful
                          ? 'rgba(255, 200, 100, 0.2)'
                          : 'rgba(255, 80, 80, 0.2)',
                        color: hasAssert ? '#ff6666' : isGraceful ? '#ffdd99' : '#ffb3b3',
                        padding: '2px 4px',
                        borderRadius: 3,
                        fontWeight: 600,
                        boxShadow: hasAssert ? '0 0 4px rgba(255, 0, 0, 0.4)' : 'none',
                      }}
                    >
                      {reasonMatch[0]}
                    </span>
                    {logMessage.substring(reasonMatch.index! + reasonMatch[0].length)}
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
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>Logs - sid {selectedSid}</div>
        <button
          onClick={() => {
            setSelectedSid(null);
            setSelectedAp(null);
          }}
          style={{
            background: 'var(--button-bg)',
            color: 'var(--text-muted)',
            border: 'none',
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
      {eventTimeline}
      <div style={{ maxHeight: 480, overflow: 'auto' }}>{elements}</div>
    </div>
  );
}

function ApPanel({
  selectedAp,
  setSelectedAp,
  setSelectedSid,
  setSelectedDb,
  setSelectedUnclassified,
  processEvents,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  setPanelFocus,
  rangeStart,
  rangeEnd,
}: any) {
  // All AP events (no sid)
  const apEvents = processEvents.filter((e: any) => e.sid === null);

  // Apply range filter if active
  const filteredEvents = rangeStart !== null && rangeEnd !== null
    ? apEvents.filter((e: any) => e.ts >= rangeStart && e.ts <= rangeEnd)
    : apEvents;

  const eventTimeline = (() => {
    if (filteredEvents.length === 0) return null;

    const minTs = Math.min(...filteredEvents.map((e) => e.ts));
    const maxTs = Math.max(...filteredEvents.map((e) => e.ts));
    const timelineWidth = 380;

    return (
      <div style={{ marginBottom: 12, padding: '8px 0' }}>
        <div
          style={{
            position: 'relative',
            height: 32,
            background: 'var(--timeline-event-bg)',
            borderRadius: 4,
            padding: '0 10px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: '50%',
              height: 2,
              background: 'rgba(159, 180, 201, 0.3)',
              transform: 'translateY(-50%)',
            }}
          />
          {filteredEvents.map((ev, idx) => {
            const pos =
              maxTs > minTs ? ((ev.ts - minTs) / (maxTs - minTs)) * timelineWidth : timelineWidth / 2;
            const isSelected = panelFocus === 'events' && focusedEventIndex === idx;
            return (
              <div
                key={idx}
                title={ev.iso}
                style={{
                  position: 'absolute',
                  left: 10 + pos,
                  top: '50%',
                  width: isSelected ? 12 : 8,
                  height: isSelected ? 12 : 8,
                  background: isSelected ? '#43bdff' : '#2b9df4',
                  transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                  zIndex: isSelected ? 10 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  setFocusedEventIndex(idx);
                  setPanelFocus('events');
                  setTimeout(() => {
                    const elem = document.querySelectorAll('.event-item')[idx];
                    if (elem) elem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  }, 50);
                }}
              />
            );
          })}
        </div>
      </div>
    );
  })();

  const elements: JSX.Element[] = [];

  filteredEvents.forEach((ev, idx) => {
    const rawLog = (ev as any).raw || ev.message;
    const logMatch = rawLog.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+(\S+)\s+(.*)$/);
    let logLevel = '';
    let threadInfo = '';
    let loggerName = '';
    let logMessage = ev.message;

    if (logMatch) {
      logLevel = logMatch[2];
      threadInfo = logMatch[3];
      loggerName = logMatch[4];
      logMessage = logMatch[5];
    }

    elements.push(
      <div
        key={idx}
        className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`}
        onClick={() => {
          setFocusedEventIndex(idx);
          setPanelFocus('events');
        }}
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.02)',
          cursor: 'pointer',
          background:
            panelFocus === 'events' && focusedEventIndex === idx
              ? 'rgba(43, 157, 244, 0.15)'
              : undefined,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.iso}</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
          {logMatch ? (
            <div>
              <span
                style={{
                  color:
                    logLevel === 'ERROR'
                      ? '#ff6666'
                      : logLevel === 'WARN'
                      ? '#ffaa66'
                      : 'var(--text-hint)',
                  fontWeight: logLevel === 'ERROR' || logLevel === 'WARN' ? 600 : 400,
                }}
              >
                {logLevel}
              </span>
              <span style={{ color: 'var(--text-hint)', margin: '0 6px' }}>|</span>
              <span style={{ color: 'var(--text-hint)', fontSize: 11 }}>[{threadInfo}]</span>
              <span style={{ color: 'var(--text-hint)', margin: '0 6px' }}>|</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                {loggerName}
              </span>
              <div style={{ marginTop: 4, color: 'var(--text-primary)' }}>
                {logMessage}
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
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>Admin Process Events</div>
        <button
          onClick={() => {
            setSelectedAp(null);
            setSelectedSid(null);
            setSelectedDb(null);
            setSelectedUnclassified(false);
          }}
          style={{
            background: 'var(--button-bg)',
            color: 'var(--text-muted)',
            border: 'none',
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
      {eventTimeline}
      <div style={{ maxHeight: 480, overflow: 'auto' }}>{elements}</div>
    </div>
  );
}
