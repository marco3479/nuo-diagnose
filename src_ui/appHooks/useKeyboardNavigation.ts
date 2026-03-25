import { useEffect } from 'react';
import type {
  DbStates,
  EventType,
  FailureProtocol,
  FocusedTimelineItem,
  Instance,
  PanelFocus,
  TableRow,
} from '../types';

declare const document: any;

type TimelineNavItem = {
  type: 'unclassified' | 'db' | 'sid';
  key: string;
};

type UseKeyboardNavigationArgs = {
  focusedRowIndex: number;
  setFocusedRowIndex: (value: number) => void;
  focusedEventIndex: number;
  setFocusedEventIndex: (value: number) => void;
  panelFocus: PanelFocus;
  setPanelFocus: (value: PanelFocus) => void;
  focusedTimelineItem: FocusedTimelineItem | null;
  setFocusedTimelineItem: (value: FocusedTimelineItem | null) => void;
  allTableRows: TableRow[];
  selectedSid: number | null;
  setSelectedSid: (value: number | null) => void;
  selectedDb: string | null;
  setSelectedDb: (value: string | null) => void;
  selectedUnclassified: boolean;
  setSelectedUnclassified: (value: boolean) => void;
  dbStates: DbStates;
  databaseEvents: EventType[];
  unclassifiedEvents: EventType[];
  events: EventType[];
  failureProtocols: FailureProtocol[];
  rowsBySid: Record<string, Instance[]>;
  addresses: string[];
  groupsByAddress: Record<string, string[]>;
  hasUnclassified: boolean;
};

function scrollFocusedEventIntoView() {
  setTimeout(() => {
    const focusedElement = document.querySelector('.event-item.focused');
    if (focusedElement) {
      focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, 10);
}

function setSelectionFromTimelineItem(
  item: TimelineNavItem,
  setSelectedUnclassified: (value: boolean) => void,
  setSelectedDb: (value: string | null) => void,
  setSelectedSid: (value: number | null) => void
) {
  if (item.type === 'unclassified') {
    setSelectedUnclassified(true);
    setSelectedDb(null);
    setSelectedSid(null);
    return;
  }

  if (item.type === 'db') {
    setSelectedDb(item.key);
    setSelectedSid(null);
    setSelectedUnclassified(false);
    return;
  }

  setSelectedSid(Number(item.key));
  setSelectedDb(null);
  setSelectedUnclassified(false);
}

function buildTimelineItems(
  hasUnclassified: boolean,
  dbStates: DbStates,
  addresses: string[],
  groupsByAddress: Record<string, string[]>
): TimelineNavItem[] {
  return [
    ...(hasUnclassified ? [{ type: 'unclassified' as const, key: 'unclassified' }] : []),
    ...Object.keys(dbStates || {}).map((db) => ({ type: 'db' as const, key: db })),
    ...addresses.flatMap((address) =>
      (groupsByAddress[address] || []).map((sid) => ({ type: 'sid' as const, key: sid }))
    ),
  ];
}

function getEventCount(
  selectedUnclassified: boolean,
  selectedDb: string | null,
  selectedSid: number | null,
  unclassifiedEvents: EventType[],
  dbStates: DbStates,
  databaseEvents: EventType[],
  rowsBySid: Record<string, Instance[]>,
  events: EventType[],
  failureProtocols: FailureProtocol[]
): number {
  if (selectedUnclassified) {
    return unclassifiedEvents.length;
  }

  if (selectedDb !== null) {
    const dbStateEvents = dbStates[selectedDb] || [];
    const dbSpecificEvents = databaseEvents.filter((event) => {
      const message = event.message ?? '';
      const raw = event.raw ?? '';
      return message.includes(selectedDb) || raw.includes(selectedDb);
    });

    return dbStateEvents.length + dbSpecificEvents.length;
  }

  if (selectedSid !== null) {
    const instancesForSid = rowsBySid[String(selectedSid)] || [];
    const relatedEvents = events.filter((event) => {
      if (event.sid === selectedSid) {
        return true;
      }

      if (event.sid === null && instancesForSid.length > 0) {
        return instancesForSid.some((instance) => event.ts >= instance.start && event.ts <= instance.end);
      }

      return false;
    });
    const failureProtocolEvents = failureProtocols.filter((protocol) => protocol.sid === selectedSid);
    return relatedEvents.length + failureProtocolEvents.length;
  }

  return 0;
}

export function useKeyboardNavigation({
  focusedRowIndex,
  setFocusedRowIndex,
  focusedEventIndex,
  setFocusedEventIndex,
  panelFocus,
  setPanelFocus,
  focusedTimelineItem,
  setFocusedTimelineItem,
  allTableRows,
  selectedSid,
  setSelectedSid,
  selectedDb,
  setSelectedDb,
  selectedUnclassified,
  setSelectedUnclassified,
  dbStates,
  databaseEvents,
  unclassifiedEvents,
  events,
  failureProtocols,
  rowsBySid,
  addresses,
  groupsByAddress,
  hasUnclassified,
}: UseKeyboardNavigationArgs) {
  useEffect(() => {
    const handleKeyDown = (e: any) => {
      if (panelFocus === 'timeline') {
        const timelineItems = buildTimelineItems(hasUnclassified, dbStates, addresses, groupsByAddress);
        const currentIndex = focusedTimelineItem
          ? timelineItems.findIndex(
              (item) => item.type === focusedTimelineItem.type && item.key === focusedTimelineItem.key
            )
          : -1;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentIndex < timelineItems.length - 1) {
            const nextItem = timelineItems[currentIndex + 1];
            if (nextItem) {
              setFocusedTimelineItem({ type: nextItem.type, key: nextItem.key, index: 0 });
              setSelectionFromTimelineItem(nextItem, setSelectedUnclassified, setSelectedDb, setSelectedSid);
            }
          } else {
            setPanelFocus('table');
            setFocusedRowIndex(0);
            if (allTableRows.length > 0) {
              const row = allTableRows[0];
              if (row?.type === 'db') {
                setSelectedDb(row.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
              } else if (row?.type === 'instance' && row.instance) {
                setSelectedSid(row.instance.sid);
                setSelectedDb(null);
                setSelectedUnclassified(false);
              }
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentIndex > 0) {
            const previousItem = timelineItems[currentIndex - 1];
            if (previousItem) {
              setFocusedTimelineItem({ type: previousItem.type, key: previousItem.key, index: 0 });
              setSelectionFromTimelineItem(previousItem, setSelectedUnclassified, setSelectedDb, setSelectedSid);
            }
          }
        } else if (e.key === 'ArrowRight' && focusedTimelineItem) {
          e.preventDefault();
          setPanelFocus('events');
          setFocusedEventIndex(0);
        }
        return;
      }

      if (panelFocus === 'table') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = Math.min(focusedRowIndex + 1, allTableRows.length - 1);
          setFocusedRowIndex(nextIndex);
          if (nextIndex >= 0 && nextIndex < allTableRows.length) {
            const row = allTableRows[nextIndex];
            if (row?.type === 'unclassified') {
              setSelectedUnclassified(true);
              setSelectedDb(null);
              setSelectedSid(null);
              setFocusedTimelineItem({ type: 'unclassified', key: 'unclassified', index: 0 });
            } else if (row?.type === 'db') {
              setSelectedDb(row.key);
              setSelectedSid(null);
              setSelectedUnclassified(false);
              setFocusedTimelineItem({ type: 'db', key: row.key, index: 0 });
            } else if (row?.type === 'instance' && row.instance) {
              setSelectedSid(row.instance.sid);
              setSelectedDb(null);
              setSelectedUnclassified(false);
              setFocusedTimelineItem({ type: 'sid', key: String(row.instance.sid), index: 0 });
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const nextIndex = Math.max(focusedRowIndex - 1, 0);
          if (focusedRowIndex === 0) {
            setPanelFocus('timeline');
            const timelineItems = buildTimelineItems(false, dbStates, addresses, groupsByAddress).filter(
              (item) => item.type !== 'unclassified'
            );
            if (timelineItems.length > 0) {
              const lastItem = timelineItems[timelineItems.length - 1];
              if (lastItem) {
                setFocusedTimelineItem({ type: lastItem.type, key: lastItem.key, index: 0 });
                if (lastItem.type === 'db') {
                  setSelectedDb(lastItem.key);
                  setSelectedSid(null);
                } else {
                  setSelectedSid(Number(lastItem.key));
                  setSelectedDb(null);
                }
              }
            }
          } else {
            setFocusedRowIndex(nextIndex);
            if (nextIndex >= 0 && nextIndex < allTableRows.length) {
              const row = allTableRows[nextIndex];
              if (row?.type === 'db') {
                setSelectedDb(row.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
                setFocusedTimelineItem({ type: 'db', key: row.key, index: 0 });
              } else if (row?.type === 'instance' && row.instance) {
                setSelectedSid(row.instance.sid);
                setSelectedDb(null);
                setSelectedUnclassified(false);
                setFocusedTimelineItem({ type: 'sid', key: String(row.instance.sid), index: 0 });
              }
            }
          }
        } else if (e.key === 'ArrowRight' && (selectedSid !== null || selectedDb !== null || selectedUnclassified)) {
          e.preventDefault();
          setPanelFocus('events');
          setFocusedEventIndex(0);
        }
        return;
      }

      if (panelFocus === 'events') {
        const eventCount = getEventCount(
          selectedUnclassified,
          selectedDb,
          selectedSid,
          unclassifiedEvents,
          dbStates,
          databaseEvents,
          rowsBySid,
          events,
          failureProtocols
        );

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedEventIndex(Math.min(focusedEventIndex + 1, eventCount - 1));
          scrollFocusedEventIntoView();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedEventIndex(Math.max(focusedEventIndex - 1, 0));
          scrollFocusedEventIntoView();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setPanelFocus('table');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    addresses,
    allTableRows,
    databaseEvents,
    dbStates,
    events,
    failureProtocols,
    focusedEventIndex,
    focusedRowIndex,
    focusedTimelineItem,
    groupsByAddress,
    hasUnclassified,
    panelFocus,
    rowsBySid,
    selectedDb,
    selectedSid,
    selectedUnclassified,
    setFocusedEventIndex,
    setFocusedRowIndex,
    setFocusedTimelineItem,
    setPanelFocus,
    setSelectedDb,
    setSelectedSid,
    setSelectedUnclassified,
    unclassifiedEvents,
  ]);
}