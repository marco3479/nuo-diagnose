import type { DbStates, EventType, FocusedTimelineItem, HoveredBar } from '../types';
import { stateColor } from '../utils';

type DatabaseTimelineProps = {
  dbStates: DbStates;
  events: EventType[];
  gStart: number;
  gEnd: number;
  cursorX: number | null;
  setCursorX: (x: number | null) => void;
  focusedTimelineItem: FocusedTimelineItem | null;
  setFocusedTimelineItem: (item: FocusedTimelineItem | null) => void;
  setPanelFocus: (focus: 'timeline' | 'table' | 'events') => void;
  setSelectedDb: (db: string | null) => void;
  setSelectedSid: (sid: number | null) => void;
  setHoveredBar: (bar: HoveredBar | null) => void;
};

export function DatabaseTimeline({
  dbStates,
  events,
  gStart,
  gEnd,
  cursorX,
  setCursorX,
  focusedTimelineItem,
  setFocusedTimelineItem,
  setPanelFocus,
  setSelectedDb,
  setSelectedSid,
  setHoveredBar,
}: DatabaseTimelineProps) {
  if (Object.keys(dbStates || {}).length === 0) {
    return (
      <div className="stack-area" style={{ marginBottom: 6 }}>
        <div className="stack-row" style={{ height: 20 }}>
          <div className="stack-label">Database</div>
          <div className="stack-track">
            <div className="hint" style={{ position: 'absolute', left: 0 }}>
              No database state transitions found in this log.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="stack-area"
      style={{ position: 'relative' }}
      onMouseMove={(e: any) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setCursorX(e.clientX - rect.left);
      }}
      onMouseLeave={() => setCursorX(null)}
    >
      {cursorX !== null && (
        <div
          style={{
            position: 'absolute',
            left: cursorX,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(255, 255, 255, 0.3)',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        />
      )}
      {Object.entries(dbStates).map(([db, segs]) => {
        return (
          <div
            key={`db-${db}`}
            className="stack-row"
            style={{
              opacity: 0.95,
              cursor: 'pointer',
              outline:
                focusedTimelineItem?.type === 'db' && focusedTimelineItem?.key === db
                  ? '2px solid rgba(43, 157, 244, 0.6)'
                  : 'none',
              outlineOffset: -2,
            }}
            onClick={() => {
              setFocusedTimelineItem({ type: 'db', key: db, index: 0 });
              setPanelFocus('timeline');
              setSelectedDb(db);
              setSelectedSid(null);
            }}
          >
            <div className="stack-label">DB {db}</div>
            <div className="stack-track">
              {segs.map((seg, idx) => {
                const left = ((seg.start - gStart) / (gEnd - gStart)) * 100;
                const right = ((seg.end - gStart) / (gEnd - gStart)) * 100;
                const width = Math.max(0.2, right - left);
                const bg = stateColor(seg.state);
                const tooltipContent = `${seg.state} — ${seg.iso}\n${seg.message}`;
                const barId = `db-${db}-${idx}`;
                return (
                  <div
                    key={`dbseg-${db}-${idx}`}
                    className="instance-bar db-bar"
                    style={{ left: `${left}%`, width: `${width}%`, background: bg, anchorName: `--${barId}` } as any}
                    onMouseEnter={() =>
                      setHoveredBar({ type: 'db', id: barId, content: tooltipContent })
                    }
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                );
              })}
              {/* Add UpdateDatabaseOptionsCommand events as slivers */}
              {(() => {
                const dbEvents = events
                  .filter((e: any) => {
                    const msg = e.message ?? '';
                    const raw = e.raw ?? '';
                    const isUpdateDbCmd =
                      /UpdateDatabaseOptionsCommand/.test(msg) ||
                      /UpdateDatabaseOptionsCommand/.test(raw);
                    const isDomainProcessStateMachine =
                      /DomainProcessStateMachine/.test(msg) ||
                      /DomainProcessStateMachine/.test(raw);
                    if (!isUpdateDbCmd || !isDomainProcessStateMachine) return false;

                    const hasDbName = msg.includes(db) || raw.includes(db);
                    const dbNamePattern = new RegExp(`name[=:\s"']+${db}`, 'i');
                    const hasDbInParams = dbNamePattern.test(msg) || dbNamePattern.test(raw);

                    const matchesAnyDb = Object.keys(dbStates || {}).some((dbName) => {
                      return (
                        msg.includes(dbName) ||
                        raw.includes(dbName) ||
                        new RegExp(`name[=:\s"']+${dbName}`, 'i').test(msg) ||
                        new RegExp(`name[=:\s"']+${dbName}`, 'i').test(raw)
                      );
                    });

                    return hasDbName || hasDbInParams || !matchesAnyDb;
                  })
                  .sort((a: any, b: any) => a.ts - b.ts);

                const groupedEvents: Array<{ events: any[]; left: number }> = [];
                const groupThreshold = 0.5;

                dbEvents.forEach((ev: any) => {
                  const left = ((ev.ts - gStart) / (gEnd - gStart)) * 100;
                  const lastGroup = groupedEvents[groupedEvents.length - 1];

                  if (lastGroup && Math.abs(left - lastGroup.left) < groupThreshold) {
                    lastGroup.events.push(ev);
                  } else {
                    groupedEvents.push({ events: [ev], left: left });
                  }
                });

                return groupedEvents.map((group, groupIdx) => {
                  const sliverId = `db-${db}-update-group-${groupIdx}`;
                  const tooltipContent = group.events
                    .map((ev) => `${ev.iso}\n${ev.raw ?? ev.message}`)
                    .join('\n\n---\n\n');
                  const width = group.events.length > 1 ? '3px' : '2px';

                  return (
                    <div
                      key={sliverId}
                      style={
                        {
                          left: `${group.left}%`,
                          position: 'absolute',
                          top: '0',
                          bottom: '0',
                          width: width,
                          background: 'hsla(280, 60%, 60%, 0.9)',
                          zIndex: 10,
                          anchorName: `--${sliverId}`,
                        } as any
                      }
                      onMouseEnter={() =>
                        setHoveredBar({ type: 'frp', id: sliverId, content: tooltipContent })
                      }
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  );
                });
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
