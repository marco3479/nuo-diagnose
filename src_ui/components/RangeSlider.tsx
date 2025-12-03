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
          {Object.keys(allRowsBySid).map((sidKey, sidIdx) => {
            const instances = allRowsBySid[sidKey];
            return instances.map((inst, instIdx) => {
              const left =
                ((inst.start - globalStart) / (globalEnd - globalStart)) * 100;
              const width =
                (((inst.end ?? inst.start) - inst.start) /
                  (globalEnd - globalStart)) *
                100;
              return (
                <div
                  key={`minimap-inst-${sidKey}-${instIdx}`}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${Math.max(width, 0.5)}%`,
                    top: 10 + sidIdx * 2,
                    height: 2,
                    background: 'hsla(42, 60%, 50%, 0.4)',
                  }}
                />
              );
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
