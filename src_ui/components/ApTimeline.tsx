import type { EventType, FocusedTimelineItem, HoveredBar } from '../types';

type ApTimelineProps = {
  processEvents: EventType[];
  loadedServer: string;
  gStart: number;
  gEnd: number;
  cursorX: number | null;
  setCursorX: (x: number | null) => void;
  focusedTimelineItem: FocusedTimelineItem | null;
  setFocusedTimelineItem: (item: FocusedTimelineItem | null) => void;
  setPanelFocus: (focus: 'timeline' | 'table' | 'events') => void;
  setSelectedAp: (ap: string | null) => void;
  setSelectedSid: (sid: number | null) => void;
  setSelectedDb: (db: string | null) => void;
  setSelectedUnclassified: (selected: boolean) => void;
  setHoveredBar: (bar: HoveredBar | null) => void;
};

export function ApTimeline({
  processEvents,
  loadedServer,
  gStart,
  gEnd,
  cursorX,
  setCursorX,
  focusedTimelineItem,
  setFocusedTimelineItem,
  setPanelFocus,
  setSelectedAp,
  setSelectedSid,
  setSelectedDb,
  setSelectedUnclassified,
  setHoveredBar,
}: ApTimelineProps) {
  // Filter AP events (no sid)
  const apEvents = processEvents.filter(ev => ev.sid === null);
  const apEventsInRange = apEvents.filter(ev => ev.ts >= gStart && ev.ts <= gEnd);

  if (apEventsInRange.length === 0) return null;

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
      
      <div 
        className="stack-row" 
        style={{ 
          cursor: 'pointer',
          outline:
            focusedTimelineItem?.type === 'ap' && focusedTimelineItem?.key === 'admin'
              ? '2px solid rgba(43, 157, 244, 0.6)'
              : 'none',
          outlineOffset: -2,
        }}
        onClick={() => {
          setFocusedTimelineItem({ type: 'ap', key: 'admin', index: 0 });
          setPanelFocus('timeline');
          setSelectedSid(null);
          setSelectedDb(null);
          setSelectedAp('admin');
          setSelectedUnclassified(false);
        }}
      >
        <div className="stack-label" style={{ fontWeight: 600 }}>
          AP - {loadedServer ? `${loadedServer}` : ''}
        </div>
        <div className="stack-track" style={{ position: 'relative' }}>
          {/* AP event markers */}
          {apEventsInRange.map((ev, idx) => {
            const pct = ((ev.ts - gStart) / (gEnd - gStart)) * 100;
            return (
              <div
                key={`ap-event-${idx}`}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#4a9eff',
                  cursor: 'pointer',
                  zIndex: 10,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPanelFocus('events');
                  setFocusedTimelineItem({ type: 'ap', key: 'admin', index: idx });
                  setSelectedSid(null);
                  setSelectedDb(null);
                  setSelectedAp('admin');
                  setSelectedUnclassified(false);
                }}
                onMouseEnter={() =>
                  setHoveredBar({ type: 'process', id: `ap-${idx}`, content: ev.message || ev.raw || '' })
                }
                onMouseLeave={() => setHoveredBar(null)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
