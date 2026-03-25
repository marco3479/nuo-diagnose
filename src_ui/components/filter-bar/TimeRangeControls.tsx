import { useMemo, useRef, type JSX } from 'react';

type TimeRangeControlsProps = {
  globalStart: number;
  globalEnd: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  setRangeStart: (start: number | null) => void;
  setRangeEnd: (end: number | null) => void;
};

export function TimeRangeControls({
  globalStart,
  globalEnd,
  rangeStart,
  rangeEnd,
  setRangeStart,
  setRangeEnd,
}: TimeRangeControlsProps): JSX.Element {
  const gStart = rangeStart ?? globalStart;
  const gEnd = rangeEnd ?? globalEnd;

  const startDateTimeRef = useRef<HTMLInputElement | null>(null);
  const endDateTimeRef = useRef<HTMLInputElement | null>(null);
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const startTimeRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);
  const endTimeRef = useRef<HTMLInputElement | null>(null);

  const pad2 = (value: number) => String(value).padStart(2, '0');
  const toDateValue = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  };
  const toTimeValue = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
  };
  const fromDateAndTime = (dateString: string, timeString: string): number => {
    const timestamp = new Date(`${dateString}T${timeString}Z`).getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.NaN;
  };
  const toDateTimeLocal = (timestamp: number): string => {
    const date = new Date(timestamp);
    const millis = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}.${millis}`;
  };
  const fromDateTimeLocal = (value: string): number => {
    if (!value) return Number.NaN;
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]{1,3}))?)?$/.exec(value);
    if (!match) return Number.NaN;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hours = Number(match[4]);
    const minutes = Number(match[5]);
    const seconds = match[6] ? Number(match[6]) : 0;
    const millis = match[7] ? Number(match[7].padEnd(3, '0')) : 0;
    if (![year, month, day, hours, minutes, seconds, millis].every(Number.isFinite)) {
      return Number.NaN;
    }
    return Date.UTC(year, month - 1, day, hours, minutes, seconds, millis);
  };

  const clampStart = (candidate: number): number => Math.max(globalStart, Math.min(candidate, gEnd));
  const clampEnd = (candidate: number): number => Math.min(globalEnd, Math.max(candidate, gStart));

  const startDate = toDateValue(gStart);
  const startTime = toTimeValue(gStart);
  const endDate = toDateValue(gEnd);
  const endTime = toTimeValue(gEnd);

  const tryShowPicker = (input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }
    const maybePicker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof maybePicker.showPicker === 'function') {
      try {
        maybePicker.showPicker();
      } catch {
        return;
      }
    }
  };

  const supportsDateTimeLocal = useMemo(() => {
    try {
      const element = document.createElement('input');
      element.setAttribute('type', 'datetime-local');
      return element.type === 'datetime-local';
    } catch {
      return false;
    }
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-primary)', borderBottom: '1px solid var(--border-primary)', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        {supportsDateTimeLocal ? (
          <>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <rect x="2" y="3" width="12" height="11" rx="1" />
                <line x1="2" y1="6" x2="14" y2="6" />
                <line x1="5" y1="1" x2="5" y2="4" />
                <line x1="11" y1="1" x2="11" y2="4" />
              </svg>
              <input
                ref={startDateTimeRef}
                type="datetime-local"
                value={toDateTimeLocal(gStart)}
                min={toDateTimeLocal(globalStart)}
                max={toDateTimeLocal(gEnd)}
                step={0.001}
                onFocus={() => tryShowPicker(startDateTimeRef.current)}
                onMouseDown={() => tryShowPicker(startDateTimeRef.current)}
                onChange={(event) => {
                  const timestamp = fromDateTimeLocal(event.currentTarget.value);
                  if (Number.isFinite(timestamp)) {
                    setRangeStart(clampStart(timestamp));
                  }
                }}
                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '4px 8px 4px 28px', fontSize: 11, cursor: 'pointer', minWidth: 210 }}
              />
            </div>
            <span style={{ color: 'var(--text-hint)' }}>→</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <rect x="2" y="3" width="12" height="11" rx="1" />
                <line x1="2" y1="6" x2="14" y2="6" />
                <line x1="5" y1="1" x2="5" y2="4" />
                <line x1="11" y1="1" x2="11" y2="4" />
              </svg>
              <input
                ref={endDateTimeRef}
                type="datetime-local"
                value={toDateTimeLocal(gEnd)}
                min={toDateTimeLocal(gStart)}
                max={toDateTimeLocal(globalEnd)}
                step={0.001}
                onFocus={() => tryShowPicker(endDateTimeRef.current)}
                onMouseDown={() => tryShowPicker(endDateTimeRef.current)}
                onChange={(event) => {
                  const timestamp = fromDateTimeLocal(event.currentTarget.value);
                  if (Number.isFinite(timestamp)) {
                    setRangeEnd(clampEnd(timestamp));
                  }
                }}
                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '4px 8px 4px 28px', fontSize: 11, cursor: 'pointer', minWidth: 210 }}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', gap: 6, alignItems: 'center' }}>
                <svg style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <rect x="2" y="3" width="12" height="11" rx="1" />
                  <line x1="2" y1="6" x2="14" y2="6" />
                  <line x1="5" y1="1" x2="5" y2="4" />
                  <line x1="11" y1="1" x2="11" y2="4" />
                </svg>
                <input
                  ref={startDateRef}
                  type="date"
                  value={startDate}
                  min={toDateValue(globalStart)}
                  max={toDateValue(globalEnd)}
                  onFocus={() => tryShowPicker(startDateRef.current)}
                  onMouseDown={() => tryShowPicker(startDateRef.current)}
                  onChange={(event) => {
                    const timestamp = fromDateAndTime(event.currentTarget.value, startTime);
                    if (Number.isFinite(timestamp)) {
                      setRangeStart(clampStart(timestamp));
                    }
                  }}
                  style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '4px 8px 4px 28px', fontSize: 11, cursor: 'pointer' }}
                />
              </div>
              <input
                ref={startTimeRef}
                type="time"
                value={startTime}
                step={1}
                onFocus={() => tryShowPicker(startTimeRef.current)}
                onMouseDown={() => tryShowPicker(startTimeRef.current)}
                onChange={(event) => {
                  const timestamp = fromDateAndTime(startDate, event.currentTarget.value);
                  if (Number.isFinite(timestamp)) {
                    setRangeStart(clampStart(timestamp));
                  }
                }}
                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', width: 110 }}
              />
            </div>
            <span style={{ color: 'var(--text-hint)' }}>→</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', gap: 6, alignItems: 'center' }}>
                <svg style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <rect x="2" y="3" width="12" height="11" rx="1" />
                  <line x1="2" y1="6" x2="14" y2="6" />
                  <line x1="5" y1="1" x2="5" y2="4" />
                  <line x1="11" y1="1" x2="11" y2="4" />
                </svg>
                <input
                  ref={endDateRef}
                  type="date"
                  value={endDate}
                  min={toDateValue(globalStart)}
                  max={toDateValue(globalEnd)}
                  onFocus={() => tryShowPicker(endDateRef.current)}
                  onMouseDown={() => tryShowPicker(endDateRef.current)}
                  onChange={(event) => {
                    const timestamp = fromDateAndTime(event.currentTarget.value, endTime);
                    if (Number.isFinite(timestamp)) {
                      setRangeEnd(clampEnd(timestamp));
                    }
                  }}
                  style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '4px 8px 4px 28px', fontSize: 11, cursor: 'pointer' }}
                />
              </div>
              <input
                ref={endTimeRef}
                type="time"
                value={endTime}
                step={1}
                onFocus={() => tryShowPicker(endTimeRef.current)}
                onMouseDown={() => tryShowPicker(endTimeRef.current)}
                onChange={(event) => {
                  const timestamp = fromDateAndTime(endDate, event.currentTarget.value);
                  if (Number.isFinite(timestamp)) {
                    setRangeEnd(clampEnd(timestamp));
                  }
                }}
                style={{ background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--input-border)', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', width: 110 }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
