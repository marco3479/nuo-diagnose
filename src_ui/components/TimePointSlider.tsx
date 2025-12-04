import React from 'react';

type TimePointSliderProps = {
  globalStart: number;
  globalEnd: number;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  allStateTimestamps: number[];
  onNext: () => void;
  onPrev: () => void;
};

export function TimePointSlider({
  globalStart,
  globalEnd,
  currentTime,
  setCurrentTime,
  allStateTimestamps,
  onNext,
  onPrev,
}: TimePointSliderProps) {
  const duration = globalEnd - globalStart;
  const position = duration > 0 ? ((currentTime - globalStart) / duration) * 100 : 0;
  const [isDragging, setIsDragging] = React.useState(false);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = globalStart + percent * duration;
    setCurrentTime(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
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

  // Filter visible states within current range
  const visibleStateTimestamps = allStateTimestamps.filter(ts => ts >= globalStart && ts <= globalEnd);
  
  // Find current state index in visible states
  const visibleCurrentIndex = visibleStateTimestamps.findIndex((ts, idx) => {
    const nextTs = visibleStateTimestamps[idx + 1];
    return currentTime >= ts && (nextTs === undefined || currentTime < nextTs);
  });

  const hasNext = allStateTimestamps.some(ts => ts > currentTime);
  const hasPrev = allStateTimestamps.some(ts => ts < currentTime);
  
  // Format the current timestamp
  const currentTimeFormatted = new Date(currentTime).toISOString().replace('T', ' ').substring(0, 23);

  return (
    <div className="timepoint-slider-container">
      <div className="stack-row">
        <div className="stack-label">
          <div className="timepoint-controls-left">
            <button
              className="timepoint-btn"
              onClick={onPrev}
              disabled={!hasPrev}
              title="Previous state"
            >
              ←
            </button>
            <div className="timepoint-info-compact">
              <div className="timepoint-state-label">
                {visibleCurrentIndex >= 0 ? visibleCurrentIndex + 1 : '?'} / {visibleStateTimestamps.length}
              </div>
              <div className="timepoint-time-compact">{currentTimeFormatted}</div>
            </div>
            <button
              className="timepoint-btn"
              onClick={onNext}
              disabled={!hasNext}
              title="Next state"
            >
              →
            </button>
          </div>
        </div>
        <div className="timepoint-track" onClick={handleClick}>
          {/* Render markers for each visible state change */}
          {visibleStateTimestamps.map((ts, idx) => {
            const markerPosition = duration > 0 ? ((ts - globalStart) / duration) * 100 : 0;
            return (
              <div
                key={idx}
                className="timepoint-state-marker"
                style={{ left: `${markerPosition}%` }}
                title={`State: ${new Date(ts).toISOString()}`}
              />
            );
          })}
          {/* Current timepoint marker */}
          <div
            className="timepoint-marker"
            style={{ left: `${position}%` }}
            onMouseDown={handleMouseDown}
          />
        </div>
      </div>
    </div>
  );
}
