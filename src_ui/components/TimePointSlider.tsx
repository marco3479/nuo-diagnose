import React from 'react';
import type { EventType, FocusedTimelineItem, HoveredBar } from '../types';

type TimePointSliderProps = {
  globalStart: number;
  globalEnd: number;
  currentTime: number | null;
  setCurrentTime: (time: number) => void;
  allStateTimestamps: number[];
  onNext: () => void;
  onPrev: () => void;
  hasDomainStates: boolean;
  // AP event props
  processEvents: EventType[];
  loadedServer: string;
  focusedTimelineItem: FocusedTimelineItem | null;
  setFocusedTimelineItem: (item: FocusedTimelineItem | null) => void;
  setPanelFocus: (focus: 'timeline' | 'table' | 'events') => void;
  setSelectedAp: (ap: string | null) => void;
  setSelectedSid: (sid: number | null) => void;
  setSelectedDb: (db: string | null) => void;
  setSelectedUnclassified: (selected: boolean) => void;
  setHoveredBar: (bar: HoveredBar | null) => void;
};

export function TimePointSlider({
  globalStart,
  globalEnd,
  currentTime,
  setCurrentTime,
  allStateTimestamps,
  onNext,
  onPrev,
  hasDomainStates,
  processEvents,
  loadedServer,
  focusedTimelineItem,
  setFocusedTimelineItem,
  setPanelFocus,
  setSelectedAp,
  setSelectedSid,
  setSelectedDb,
  setSelectedUnclassified,
  setHoveredBar,
}: TimePointSliderProps) {
  const duration = globalEnd - globalStart;
  const effectiveTime = currentTime ?? globalStart;
  const position = duration > 0 ? ((effectiveTime - globalStart) / duration) * 100 : 0;
  const [isDragging, setIsDragging] = React.useState(false);

  // AP events (no sid)
  const apEvents = React.useMemo(
    () => processEvents.filter(ev => ev.sid === null),
    [processEvents]
  );
  const apEventsInRange = React.useMemo(
    () => apEvents.filter(ev => ev.ts >= globalStart && ev.ts <= globalEnd),
    [apEvents, globalStart, globalEnd]
  );

  const visibleStateTimestamps = React.useMemo(() => {
    const filtered = allStateTimestamps.filter((ts) => ts >= globalStart && ts <= globalEnd);
    filtered.sort((a, b) => a - b);
    const deduped: number[] = [];
    for (const ts of filtered) {
      if (deduped.length === 0 || deduped[deduped.length - 1] !== ts) deduped.push(ts);
    }
    return deduped;
  }, [allStateTimestamps, globalStart, globalEnd]);

  // If there are no AP events and no domain states, hide entirely
  if (apEvents.length === 0 && !hasDomainStates) return null;
  // If no AP events in range and no domain states and no loaded server, hide
  if (apEventsInRange.length === 0 && !hasDomainStates && !loadedServer) return null;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasDomainStates) return;
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = globalStart + percent * duration;
    setCurrentTime(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!hasDomainStates) return;
    setIsDragging(true);
    e.preventDefault();
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const track = document.querySelector('.timepoint-track') as HTMLElement;
      if (!track) return;
      
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percent = x / rect.width;
      const newTime = globalStart + percent * duration;
      setCurrentTime(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, globalStart, duration, setCurrentTime]);

  // Current state index = most recent state-change timestamp at or before currentTime
  let visibleCurrentIndex = -1;
  for (let i = 0; i < visibleStateTimestamps.length; i++) {
    if (visibleStateTimestamps[i]! <= effectiveTime) visibleCurrentIndex = i;
    else break;
  }

  const hasNext = visibleCurrentIndex < visibleStateTimestamps.length - 1;
  const hasPrev = visibleCurrentIndex > 0;
  
  // Format the current timestamp
  const currentTimeFormatted = new Date(effectiveTime).toISOString().replace('T', ' ').substring(0, 23);

  const isApFocused = focusedTimelineItem?.type === 'ap' && focusedTimelineItem?.key === 'admin';

  return (
    <div className="timepoint-slider-container">
      <div
        className="stack-row"
        style={{
          cursor: 'pointer',
          outline: isApFocused ? '2px solid rgba(43, 157, 244, 0.6)' : 'none',
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
        <div className="stack-label">
          {hasDomainStates ? (
            <div className="timepoint-controls-left">
              <button
                className="timepoint-btn"
                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                disabled={!hasPrev}
                title="Previous state"
              >
                ←
              </button>
              <div className="timepoint-info-compact">
                <div className="timepoint-state-label">
                  {Math.max(0, visibleCurrentIndex + 1)} / {visibleStateTimestamps.length}
                </div>
                <div className="timepoint-time-compact">{currentTimeFormatted}</div>
              </div>
              <button
                className="timepoint-btn"
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                disabled={!hasNext}
                title="Next state"
              >
                →
              </button>
            </div>
          ) : (
            <div
              style={{
                fontWeight: 600,
                fontSize: 12,
                textAlign: 'right',
                paddingRight: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={() =>
                setHoveredBar({ type: 'process', id: 'ap-label', content: `AP - ${loadedServer || ''}` })
              }
              onMouseLeave={() => setHoveredBar(null)}
            >
              AP{loadedServer ? ` - ${loadedServer}` : ''}
            </div>
          )}
        </div>
        <div
          className="timepoint-track"
          onClick={(e) => { e.stopPropagation(); handleTrackClick(e); }}
          style={{ cursor: hasDomainStates ? 'pointer' : 'default' }}
        >
          {/* Domain state change markers */}
          {visibleStateTimestamps.map((ts, idx) => {
            const markerPosition = duration > 0 ? ((ts - globalStart) / duration) * 100 : 0;
            return (
              <div
                key={`state-${idx}`}
                className="timepoint-state-marker"
                style={{ left: `${markerPosition}%` }}
                title={`State: ${new Date(ts).toISOString()}`}
              />
            );
          })}
          {/* AP event markers */}
          {apEventsInRange.map((ev, idx) => {
            const pct = ((ev.ts - globalStart) / duration) * 100;
            const logLine = `[${ev.iso || new Date(ev.ts).toISOString()}] ${ev.raw || ev.message}`;
            return (
              <div
                key={`ap-event-${idx}`}
                className="ap-event-marker"
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
                  zIndex: 15,
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
                  setHoveredBar({ type: 'process', id: `ap-${idx}`, content: logLine })
                }
                onMouseLeave={() => setHoveredBar(null)}
              />
            );
          })}
          {/* Current timepoint marker (only when domain states available) */}
          {hasDomainStates && (
            <div
              className="timepoint-marker"
              style={{ left: `${position}%` }}
              onMouseDown={handleMouseDown}
            />
          )}
        </div>
      </div>
    </div>
  );
}
