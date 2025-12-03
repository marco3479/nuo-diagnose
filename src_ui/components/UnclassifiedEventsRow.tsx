import type { EventType, FocusedTimelineItem, HoveredBar } from '../types';

type UnclassifiedEventsRowProps = {
  unclassifiedEvents: EventType[];
  gStart: number;
  gEnd: number;
  selectedUnclassified: boolean;
  setSelectedUnclassified: (selected: boolean) => void;
  setSelectedSid: (sid: number | null) => void;
  setSelectedDb: (db: string | null) => void;
  setPanelFocus: (focus: 'timeline' | 'table' | 'events') => void;
  setFocusedTimelineItem: (item: FocusedTimelineItem | null) => void;
  setHoveredBar: (bar: HoveredBar | null) => void;
};

export function UnclassifiedEventsRow({
  unclassifiedEvents,
  gStart,
  gEnd,
  selectedUnclassified,
  setSelectedUnclassified,
  setSelectedSid,
  setSelectedDb,
  setPanelFocus,
  setFocusedTimelineItem,
  setHoveredBar,
}: UnclassifiedEventsRowProps) {
  if (unclassifiedEvents.length === 0) {
    return null;
  }

  return (
    <div className="stack-area" style={{ marginBottom: 6 }}>
      <div
        className="stack-row"
        style={{
          opacity: 0.95,
          cursor: 'pointer',
          outline: selectedUnclassified ? '2px solid rgba(43, 157, 244, 0.6)' : 'none',
          outlineOffset: -2,
        }}
        onClick={() => {
          setSelectedUnclassified(true);
          setSelectedSid(null);
          setSelectedDb(null);
          setPanelFocus('table');
          setFocusedTimelineItem({ type: 'unclassified', key: 'unclassified', index: 0 });
        }}
      >
        <div className="stack-label">Unclassified Events ({unclassifiedEvents.length})</div>
        <div className="stack-track">
          {unclassifiedEvents.map((ev: any, idx: number) => {
            const left = ((ev.ts - gStart) / (gEnd - gStart)) * 100;
            const dotId = `unclassified-${idx}`;
            return (
              <div
                key={dotId}
                className="frp-dot"
                style={
                  {
                    left: `${left}%`,
                    position: 'absolute',
                    top: '2px',
                    width: 8,
                    height: 8,
                    background: 'hsla(280, 60%, 50%, 0.9)',
                    transform: 'rotate(45deg)',
                    zIndex: 10,
                    anchorName: `--${dotId}`,
                  } as any
                }
                onMouseEnter={() =>
                  setHoveredBar({
                    type: 'frp',
                    id: dotId,
                    content: `${ev.iso}\n${ev.raw ?? ev.message}`,
                  })
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
