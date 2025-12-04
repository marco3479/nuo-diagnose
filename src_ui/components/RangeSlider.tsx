type RangeSliderProps = {
  globalStart: number;
  globalEnd: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  setRangeStart: (start: number | null) => void;
  setRangeEnd: (end: number | null) => void;
  dragging: 'start' | 'end' | 'range' | null;
  setDragging: (mode: 'start' | 'end' | 'range' | null) => void;
  setDragStartX: (x: number) => void;
  setDragStartRange: (range: { start: number; end: number }) => void;
  allRowsBySid: Record<string, any[]>;
  dbStates: Record<string, any[]>;
  events: any[];
  addresses: string[];
  groupsByAddress: Record<string, string[]>;
};

export function RangeSlider({
  globalStart,
  globalEnd,
  rangeStart,
  rangeEnd,
  setRangeStart,
  setRangeEnd,
  dragging,
  setDragging,
  setDragStartX,
  setDragStartRange,
  allRowsBySid,
  dbStates,
  events,
  addresses,
  groupsByAddress,
}: RangeSliderProps): JSX.Element {
  const gStart = rangeStart ?? globalStart;
  const gEnd = rangeEnd ?? globalEnd;

  return (
    <div style={{ display: 'flex', marginTop: 8, marginBottom: 12 }}>
      <div style={{ width: 'var(--label-width)', flexShrink: 0 }} />
      <div
        className="range-slider-track"
        style={{ flex: 1, position: 'relative', height: 80 }}
      >
        {/* Minimap background */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            background: 'var(--bg-secondary)',
            borderRadius: 4,
            border: '1px solid var(--border-secondary)',
          }}
        >
          {/* Database states minimap */}
          {Object.keys(dbStates || {}).map((dbName, dbIdx) => {
            const segments = dbStates[dbName] || [];
            return segments.map((seg: any, segIdx: number) => {
              const left =
                ((seg.start - globalStart) / (globalEnd - globalStart)) * 100;
              const width =
                ((seg.end - seg.start) / (globalEnd - globalStart)) * 100;
              return (
                <div
                  key={`minimap-db-${dbName}-${segIdx}`}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${width}%`,
                    top: dbIdx * 2,
                    height: 2,
                    background: 'hsla(200, 60%, 50%, 0.4)',
                  }}
                />
              );
            });
          })}
          {/* Process instances minimap */}
          {addresses.flatMap((addr, addrIdx) => {
            const sids = groupsByAddress[addr] || [];
            return sids.flatMap((sid, sidIdxInAddr) => {
              const instances = allRowsBySid[sid] || [];
              // Calculate the global index for vertical positioning
              const sidsBefore = addresses.slice(0, addrIdx).reduce(
                (count, a) => count + (groupsByAddress[a] || []).length,
                0
              );
              const globalSidIdx = sidsBefore + sidIdxInAddr;
              
              return instances.map((inst, instIdx) => {
                // Check if there are any RemoveNodeCommand events for this instance
                const removeEvents = events.filter(
                  (e: any) =>
                    e.sid === inst.sid && /RemoveNodeCommand/.test(e.message ?? '')
                );
                // If no remove command, extend to globalEnd (like the main timeline)
                const effectiveEnd = removeEvents.length > 0 ? inst.end : globalEnd;
                
                const left =
                  ((inst.start - globalStart) / (globalEnd - globalStart)) * 100;
                const width =
                  ((effectiveEnd - inst.start) / (globalEnd - globalStart)) * 100;
                return (
                  <div
                    key={`minimap-inst-${sid}-${instIdx}`}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${Math.max(width, 0.5)}%`,
                      top: 10 + globalSidIdx * 2,
                      height: 2,
                      background: 'hsla(42, 60%, 50%, 0.4)',
                    }}
                  />
                );
              });
            });
          })}
          {/* ASSERT markers minimap */}
          {addresses.flatMap((addr, addrIdx) => {
            const sids = groupsByAddress[addr] || [];
            return sids.flatMap((sid, sidIdxInAddr) => {
              // Calculate the global index for vertical positioning
              const sidsBefore = addresses.slice(0, addrIdx).reduce(
                (count, a) => count + (groupsByAddress[a] || []).length,
                0
              );
              const globalSidIdx = sidsBefore + sidIdxInAddr;
              
              // Find ASSERT events for this sid
              const assertEvents = events.filter((e: any) => {
                if (e.sid !== Number(sid)) return false;
                if (!/RemoveNodeCommand/.test(e.message ?? '')) return false;
                const reasonMatch = e.message?.match(
                  /reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/
                );
                return reasonMatch && /ASSERT/i.test(reasonMatch[0]);
              });
              
              return assertEvents.map((assertEvent, idx) => {
                const left =
                  ((assertEvent.ts - globalStart) / (globalEnd - globalStart)) * 100;
                return (
                  <div
                    key={`minimap-assert-${sid}-${idx}`}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: 2,
                      top: 10 + globalSidIdx * 2,
                      height: 2,
                      background: 'hsla(0, 100%, 40%, 1)',
                      transform: 'rotate(45deg)',
                      zIndex: 5,
                      boxShadow: '0 0 3px 1px rgba(255, 0, 0, 0.9), 0 0 6px 2px rgba(255, 0, 0, 0.5)',
                    }}
                  />
                );
              });
            });
          })}
        </div>
        {/* Range selection overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`,
              right: `${100 - ((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%`,
              height: '100%',
              background: 'rgba(46, 204, 113, 0.15)',
              border: '2px solid rgba(46, 204, 113, 0.6)',
              borderRadius: 4,
              pointerEvents: 'all',
              cursor: 'grab',
            }}
            onMouseDown={(e: any) => {
              e.preventDefault();
              setDragging('range');
              setDragStartX(e.clientX);
              setDragStartRange({ start: gStart, end: gEnd });
            }}
          />
        </div>
        {/* Handles */}
        <div
          style={{
            position: 'absolute',
            left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`,
            top: 22,
            width: 16,
            height: 16,
            background: 'var(--range-handle-bg)',
            border: '3px solid var(--accent)',
            borderRadius: '50%',
            cursor: 'ew-resize',
            zIndex: 3,
            transform: 'translateX(-50%)',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging('start');
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%`,
            top: 22,
            width: 16,
            height: 16,
            background: 'var(--range-handle-bg)',
            border: '3px solid var(--accent)',
            borderRadius: '50%',
            cursor: 'ew-resize',
            zIndex: 3,
            transform: 'translateX(-50%)',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging('end');
          }}
        />
        {/* Time labels */}
        <div
          style={{
            position: 'absolute',
            top: 62,
            left: 0,
            right: 0,
            fontSize: 11,
            color: 'var(--text-hint)',
            textAlign: 'center',
          }}
        >
          {new Date(gStart).toISOString()} → {new Date(gEnd).toISOString()}
        </div>
      </div>
    </div>
  );
}
