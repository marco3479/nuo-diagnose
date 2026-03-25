import { useEffect, useRef } from 'react';

declare const document: any;
declare const window: any;

type UseLayoutInteractionsArgs = {
  globalStart: number;
  globalEnd: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  setRangeStart: (value: number | null) => void;
  setRangeEnd: (value: number | null) => void;
  dragging: 'start' | 'end' | 'range' | null;
  setDragging: (value: 'start' | 'end' | 'range' | null) => void;
  dragStartX: number;
  dragStartRange: { start: number; end: number };
  isResizing: boolean;
  setIsResizing: (value: boolean) => void;
  setDomainPanelWidth: (value: number) => void;
  isResizingTimeline: boolean;
  setIsResizingTimeline: (value: boolean) => void;
  setTimelineHeight: (value: number) => void;
};

export function useLayoutInteractions({
  globalStart,
  globalEnd,
  rangeStart,
  rangeEnd,
  setRangeStart,
  setRangeEnd,
  dragging,
  setDragging,
  dragStartX,
  dragStartRange,
  isResizing,
  setIsResizing,
  setDomainPanelWidth,
  isResizingTimeline,
  setIsResizingTimeline,
  setTimelineHeight,
}: UseLayoutInteractionsArgs) {
  const rangeStartRef = useRef<number | null>(rangeStart);
  const rangeEndRef = useRef<number | null>(rangeEnd);
  const globalStartRef = useRef<number>(globalStart);
  const globalEndRef = useRef<number>(globalEnd);
  const dragStartXRef = useRef<number>(dragStartX);
  const dragStartRangeRef = useRef<{ start: number; end: number }>(dragStartRange);

  useEffect(() => {
    rangeStartRef.current = rangeStart;
  }, [rangeStart]);

  useEffect(() => {
    rangeEndRef.current = rangeEnd;
  }, [rangeEnd]);

  useEffect(() => {
    globalStartRef.current = globalStart;
  }, [globalStart]);

  useEffect(() => {
    globalEndRef.current = globalEnd;
  }, [globalEnd]);

  useEffect(() => {
    dragStartXRef.current = dragStartX;
  }, [dragStartX]);

  useEffect(() => {
    dragStartRangeRef.current = dragStartRange;
  }, [dragStartRange]);

  useEffect(() => {
    if (!isResizingTimeline) {
      return;
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const appElement = document.querySelector('.app');
      if (!appElement) {
        return;
      }

      const rect = appElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const percentage = (relativeY / rect.height) * 100;
      const clampedPercentage = Math.max(30, Math.min(80, percentage));
      setTimelineHeight(clampedPercentage);
    };

    const handleMouseUp = () => {
      setIsResizingTimeline(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingTimeline, setIsResizingTimeline, setTimelineHeight]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - e.clientX;
      const clampedWidth = Math.max(300, Math.min(800, newWidth));
      setDomainPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, setDomainPanelWidth, setIsResizing]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handleMouseMove = (e: any) => {
      const slider = document.querySelector('.range-slider-track');
      if (!slider) {
        return;
      }

      const rect = slider.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ts = globalStartRef.current + fraction * (globalEndRef.current - globalStartRef.current);

      if (dragging === 'start') {
        const currentEnd = rangeEndRef.current ?? globalEndRef.current;
        setRangeStart(Math.min(ts, currentEnd));
      } else if (dragging === 'end') {
        const currentStart = rangeStartRef.current ?? globalStartRef.current;
        setRangeEnd(Math.max(ts, currentStart));
      } else if (dragging === 'range') {
        const deltaX = e.clientX - dragStartXRef.current;
        const deltaFraction = deltaX / rect.width;
        const deltaTs = deltaFraction * (globalEndRef.current - globalStartRef.current);
        const span = dragStartRangeRef.current.end - dragStartRangeRef.current.start;
        let nextStart = dragStartRangeRef.current.start + deltaTs;
        let nextEnd = dragStartRangeRef.current.end + deltaTs;

        if (nextStart < globalStartRef.current) {
          nextStart = globalStartRef.current;
          nextEnd = globalStartRef.current + span;
        }

        if (nextEnd > globalEndRef.current) {
          nextEnd = globalEndRef.current;
          nextStart = globalEndRef.current - span;
        }

        setRangeStart(nextStart);
        setRangeEnd(nextEnd);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, setDragging, setRangeEnd, setRangeStart]);
}