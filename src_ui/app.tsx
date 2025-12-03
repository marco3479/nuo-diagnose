import React, { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import assert from '../assert';
import type {
  Instance,
  DbStates,
  FailureProtocol,
  ServerTimeRange,
  EventType,
  HoveredBar,
  FocusedTimelineItem,
  TableRow,
  SortKey,
  SortDir,
} from './types';
import {
  stateColor,
  getInstanceType,
  calculateProcessColor,
  sortInstances,
  groupInstancesByAddress,
  sortAddressesByEarliestStart,
} from './utils';
import {
  useTheme,
  useMousePosition,
  useDropdownOutsideClick,
  useUrlNavigation,
  useZdTickets,
  loadFromFile,
  loadFromNuoSupport,
  loadDiagnosePackages,
  loadServerTimeRanges,
} from './hooks';
import { classifyEvents } from './eventClassifier';
import {
  Controls,
  ServerTimeline,
  FilterBar,
  RangeSlider,
  Tooltip,
  LoadingSpinner,
  DatabaseTimeline,
  UnclassifiedEventsRow,
  ProcessTimeline,
  LogPanel,
} from './components';

declare const fetch: any;
declare const document: any;
declare const window: any;

function StackApp(): JSX.Element {
  const [path, setPath] = useState('tests/mock/nuoadmin.log');
  // Detect initial mode from URL - default to nuosupport unless explicitly at root with file mode
  const initialMode = window.location.pathname === '/' || window.location.pathname.startsWith('/nuosupport') ? 'nuosupport' : 'file';
  const [loadMode, setLoadMode] = useState<'file' | 'nuosupport'>(initialMode);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [diagnosePackages, setDiagnosePackages] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [servers, setServers] = useState<string[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [serverTimeRanges, setServerTimeRanges] = useState<ServerTimeRange[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [dbStates, setDbStates] = useState<DbStates>({});
  const [failureProtocols, setFailureProtocols] = useState<FailureProtocol[]>([]);
  const [selectedSid, setSelectedSid] = useState<number | null>(null);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [selectedUnclassified, setSelectedUnclassified] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [globalStart, setGlobalStart] = useState<number>(Date.now());
  const [globalEnd, setGlobalEnd] = useState<number>(Date.now() + 1);
  const [loading, setLoading] = useState(false);
  const [loadedServer, setLoadedServer] = useState<string>('');
  // Table filters & sorting
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterServers, setFilterServers] = useState<Set<string>>(new Set());
  const [filterSids, setFilterSids] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('sid');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'range' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartRange, setDragStartRange] = useState<{start: number, end: number}>({start: 0, end: 0});
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const [focusedEventIndex, setFocusedEventIndex] = useState<number>(-1);
  const [panelFocus, setPanelFocus] = useState<'timeline' | 'table' | 'events'>('timeline');
  const [focusedTimelineItem, setFocusedTimelineItem] = useState<FocusedTimelineItem | null>(null);
  const [hoveredBar, setHoveredBar] = useState<HoveredBar | null>(null);
  const [apsCollapsed, setApsCollapsed] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [sidDropdownOpen, setSidDropdownOpen] = useState(false);

  // Use custom hooks
  const { theme, setTheme } = useTheme('dark');
  const { mousePos, setMousePos } = useMousePosition();
  const zdTickets = useZdTickets();
  
  useDropdownOutsideClick(serverDropdownOpen, sidDropdownOpen, setServerDropdownOpen, setSidDropdownOpen);
  useUrlNavigation(loadMode);

  async function load(p = path) {
    setLoading(true);
    try {
      const data = await loadFromFile(p);
      setInstances(data.instances);
      setEvents(data.events);
      setDbStates(data.dbStates);
      setFailureProtocols(data.failureProtocols);
      setLoadedServer('');
      
      if (data.range && data.range.start && data.range.end) {
        setGlobalStart(data.range.start);
        setGlobalEnd(data.range.end);
        setRangeStart(data.range.start);
        setRangeEnd(data.range.end);
      } else if (data.instances.length) {
        const firstInst = data.instances[0]!;
        const lastInst = data.instances[data.instances.length - 1] ?? firstInst;
        setGlobalStart(firstInst.start);
        setGlobalEnd(lastInst.end ?? lastInst.start);
        setRangeStart(firstInst.start);
        setRangeEnd(lastInst.end ?? lastInst.start);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadFromNuoSupportHandler() {
    if (!selectedTicket || !selectedPackage || !selectedServer) return;
    setLoading(true);
    try {
      const data = await loadFromNuoSupport(selectedTicket, selectedPackage, selectedServer);
      
      if (data.error) {
        console.error(data.error);
        alert(`Error: ${data.error}`);
        return;
      }
      
      setInstances(data.instances);
      setEvents(data.events);
      setDbStates(data.dbStates);
      setFailureProtocols(data.failureProtocols);
      setLoadedServer(data.server || selectedServer);
      
      if (data.range && data.range.start && data.range.end) {
        setGlobalStart(data.range.start);
        setGlobalEnd(data.range.end);
        setRangeStart(data.range.start);
        setRangeEnd(data.range.end);
      } else if (data.instances.length) {
        const firstInst = data.instances[0]!;
        const lastInst = data.instances[data.instances.length - 1] ?? firstInst;
        setGlobalStart(firstInst.start);
        setGlobalEnd(lastInst.end ?? lastInst.start);
        setRangeStart(firstInst.start);
        setRangeEnd(lastInst.end ?? lastInst.start);
      }
    } catch (e) {
      console.error(e);
      alert(`Error loading diagnose: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  // Parse URL parameters like /nuosupport/zd12345/diagnose-20231201/server01
  useEffect(() => {
    const urlPath = window.location.pathname;
    const fullMatch = urlPath.match(/\/nuosupport\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    const packageMatch = urlPath.match(/\/nuosupport\/([^\/]+)\/([^\/]+)$/);
    const ticketMatch = urlPath.match(/\/nuosupport\/([^\/]+)$/);
    
    if (zdTickets.length > 0) {
      if (fullMatch) {
        const [, ticket, pkg, server] = fullMatch;
        setSelectedTicket(ticket);
        (window as any).__initialPackage = pkg;
        (window as any).__initialServer = server;
      } else if (packageMatch) {
        const [, ticket, pkg] = packageMatch;
        setSelectedTicket(ticket);
        (window as any).__initialPackage = pkg;
      } else if (ticketMatch) {
        const [, ticket] = ticketMatch;
        setSelectedTicket(ticket);
      }
    }
  }, [zdTickets]);

  // Load diagnose packages when ticket selected
  useEffect(() => {
    if (!selectedTicket) {
      setDiagnosePackages([]);
      setSelectedPackage('');
      return;
    }
    
    setSelectedPackage('');
    setSelectedServer('');
    setServers([]);
    setServerTimeRanges([]);
    
    if (loadMode === 'nuosupport' && !(window as any).__initialPackage) {
      window.history.pushState({}, '', `/nuosupport/${selectedTicket}`);
    }
    
    loadDiagnosePackages(selectedTicket)
      .then((packages) => {
        setDiagnosePackages(packages);
        const initialPkg = (window as any).__initialPackage;
        if (initialPkg && packages.includes(initialPkg)) {
          setSelectedPackage(initialPkg);
          delete (window as any).__initialPackage;
        } else if (packages.length > 0) {
          setSelectedPackage(packages[0]);
        }
      })
      .catch((e: any) => console.error('Failed to load packages:', e));
  }, [selectedTicket, loadMode]);

  // Load servers when package selected
  useEffect(() => {
    if (!selectedTicket || !selectedPackage) {
      setServers([]);
      setSelectedServer('');
      setServerTimeRanges([]);
      return;
    }
    
    if (!diagnosePackages.includes(selectedPackage)) {
      console.log('Skipping server fetch - package not in current ticket');
      return;
    }
    
    if (loadMode === 'nuosupport' && !(window as any).__initialServer) {
      window.history.pushState({}, '', `/nuosupport/${selectedTicket}/${selectedPackage}`);
    }
    
    setSelectedServer('');
    setServers([]);
    setServerTimeRanges([]);
    setLoading(true);
    
    loadServerTimeRanges(selectedTicket, selectedPackage)
      .then((serverRanges) => {
        setLoading(false);
        setServerTimeRanges(serverRanges);
        const servers = serverRanges.map((r: ServerTimeRange) => r.server);
        setServers(servers);
        
        const initialServer = (window as any).__initialServer;
        if (initialServer && servers.includes(initialServer)) {
          setSelectedServer(initialServer);
          delete (window as any).__initialServer;
        } else if (servers.length > 0) {
          setSelectedServer(servers[0]);
        }
      })
      .catch((e: any) => {
        setLoading(false);
        console.error('Server time ranges error:', e);
      });
  }, [selectedTicket, selectedPackage, diagnosePackages, loadMode]);

  // Automatically load when server is selected
  useEffect(() => {
    if (selectedServer && selectedTicket && selectedPackage && loadMode === 'nuosupport') {
      const newPath = `/nuosupport/${selectedTicket}/${selectedPackage}/${selectedServer}`;
      window.history.pushState({}, '', newPath);
      loadFromNuoSupportHandler();
    }
  }, [selectedServer]);

  const span = Math.max(1, (rangeEnd ?? globalEnd) - (rangeStart ?? globalStart));
  const gStart = rangeStart ?? globalStart;
  const gEnd = rangeEnd ?? globalEnd;

  // visible instances intersecting selection
  const visible = instances.filter(i => {
    const removeEvents = events.filter((e: any) => {
      return e.sid === i.sid && /RemoveNodeCommand/.test(e.message ?? '');
    });
    const effectiveEnd = removeEvents.length > 0 ? i.end : globalEnd;
    return effectiveEnd >= gStart && i.start <= gEnd;
  });

  // Build filter options
  const allRowsBySid: Record<string, Instance[]> = {};
  for (const inst of instances) {
    const key = String(inst.sid);
    (allRowsBySid[key] ||= []).push(inst);
  }
  
  const instanceTypeGetter = (i: Instance): string => getInstanceType(i, allRowsBySid);
  const typeOptions = Array.from(new Set(instances.map(instanceTypeGetter).filter(Boolean))).sort();
  const allServers = Array.from(new Set(instances.map(i => i.address).filter(Boolean) as string[])).sort();
  const allSids = Array.from(new Set(instances.map(i => String(i.sid)))).sort((a, b) => Number(a) - Number(b));
  
  // Apply filters
  const filtered = visible.filter(i => {
    const t = instanceTypeGetter(i);
    if (filterType !== 'ALL' && t !== filterType) return false;
    if (filterServers.size > 0 && !filterServers.has(i.address ?? '')) return false;
    if (filterSids.size > 0 && !filterSids.has(String(i.sid))) return false;
    return true;
  });

  // Group filtered rows by sid
  const rowsBySid: Record<string, Instance[]> = {};
  for (const inst of filtered) {
    const key = String(inst.sid);
    (rowsBySid[key] ||= []).push(inst);
  }

  // Sort instances
  const visibleSorted = sortInstances(filtered, sortKey, sortDir, instanceTypeGetter);

  // Classify events
  const { processEvents, databaseEvents, unclassifiedEvents } = classifyEvents(events, dbStates);
  
  const hasUnclassified = unclassifiedEvents.length > 0;
  const allTableRows: TableRow[] = [
    ...(hasUnclassified ? [{ type: 'unclassified' as const, key: 'unclassified' }] : []),
    ...Object.keys(dbStates || {}).map(db => ({ type: 'db' as const, key: db })), 
    ...visibleSorted.map((inst, idx) => ({ type: 'instance' as const, key: `inst-${idx}`, instance: inst }))
  ];

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Group sids by address
  const groupsByAddress = groupInstancesByAddress(rowsBySid);
  const addresses = sortAddressesByEarliestStart(groupsByAddress, rowsBySid);

  // Handle dragging for range slider
  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: any) => {
      const slider = (document as any).querySelector('.range-slider-track');
      if (!slider) return;
      const rect = slider.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ts = globalStart + fraction * (globalEnd - globalStart);
      if (dragging === 'start') {
        const currentEnd = rangeEnd ?? globalEnd;
        setRangeStart(Math.min(ts, currentEnd));
      } else if (dragging === 'end') {
        const currentStart = rangeStart ?? globalStart;
        setRangeEnd(Math.max(ts, currentStart));
      } else if (dragging === 'range') {
        const deltaX = e.clientX - dragStartX;
        const deltaFraction = deltaX / rect.width;
        const deltaTs = deltaFraction * (globalEnd - globalStart);
        const span = dragStartRange.end - dragStartRange.start;
        let newStart = dragStartRange.start + deltaTs;
        let newEnd = dragStartRange.end + deltaTs;
        if (newStart < globalStart) {
          newStart = globalStart;
          newEnd = globalStart + span;
        }
        if (newEnd > globalEnd) {
          newEnd = globalEnd;
          newStart = globalEnd - span;
        }
        setRangeStart(newStart);
        setRangeEnd(newEnd);
      }
    };
    const handleMouseUp = () => setDragging(null);
    (document as any).addEventListener('mousemove', handleMouseMove);
    (document as any).addEventListener('mouseup', handleMouseUp);
    return () => {
      (document as any).removeEventListener('mousemove', handleMouseMove);
      (document as any).removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, globalStart, globalEnd, rangeStart, rangeEnd, dragStartX, dragStartRange]);

  // Keyboard navigation for table rows
  useEffect(() => {
    const handleKeyDown = (e: any) => {
      if (panelFocus === 'timeline') {
        // Build timeline items list (ap + unclassified + db rows + sid rows)
        const timelineItems: Array<{type: 'unclassified' | 'db' | 'sid', key: string}> = [
          ...(hasUnclassified ? [{ type: 'unclassified' as const, key: 'unclassified' }] : []),
          ...Object.keys(dbStates || {}).map(db => ({ type: 'db' as const, key: db })),
          ...addresses.flatMap(addr => (groupsByAddress[addr] || []).map(sid => ({ type: 'sid' as const, key: sid })))
        ];
        
        const currentIndex = focusedTimelineItem ? timelineItems.findIndex(item => item.type === focusedTimelineItem.type && item.key === focusedTimelineItem.key) : -1;
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentIndex < timelineItems.length - 1) {
            const nextItem = timelineItems[currentIndex + 1];
            if (nextItem) {
              setFocusedTimelineItem({type: nextItem.type, key: nextItem.key, index: 0});
              if (nextItem.type === 'unclassified') {
                setSelectedUnclassified(true);
                setSelectedDb(null);
                setSelectedSid(null);
              } else if (nextItem.type === 'db') {
                setSelectedDb(nextItem.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
              } else {
                setSelectedSid(Number(nextItem.key));
                setSelectedDb(null);
                setSelectedUnclassified(false);
              }
            }
          } else {
            // Move to table
            setPanelFocus('table');
            setFocusedRowIndex(0);
            if (allTableRows.length > 0) {
              const row = allTableRows[0];
              if (row && row.type === 'db') {
                setSelectedDb(row.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
              } else if (row && row.type === 'instance' && 'instance' in row && row.instance) {
                setSelectedSid(row.instance.sid);
                setSelectedDb(null);
                setSelectedUnclassified(false);
              }
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentIndex > 0) {
            const prevItem = timelineItems[currentIndex - 1];
            if (prevItem) {
              setFocusedTimelineItem({type: prevItem.type, key: prevItem.key, index: 0});
              if (prevItem.type === 'unclassified') {
                setSelectedUnclassified(true);
                setSelectedDb(null);
                setSelectedSid(null);
              } else if (prevItem.type === 'db') {
                setSelectedDb(prevItem.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
              } else {
                setSelectedSid(Number(prevItem.key));
                setSelectedDb(null);
                setSelectedUnclassified(false);
              }
            }
          }
        } else if (e.key === 'ArrowRight' && focusedTimelineItem) {
          e.preventDefault();
          setPanelFocus('events');
          setFocusedEventIndex(0);
        }
      } else if (panelFocus === 'table') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = Math.min(focusedRowIndex + 1, allTableRows.length - 1);
          setFocusedRowIndex(newIndex);
          if (newIndex >= 0 && newIndex < allTableRows.length) {
            const row = allTableRows[newIndex];
            if (row && row.type === 'unclassified') {
              setSelectedUnclassified(true);
              setSelectedDb(null);
              setSelectedSid(null);
              setFocusedTimelineItem({type: 'unclassified', key: 'unclassified', index: 0});
            } else if (row && row.type === 'db') {
              setSelectedDb(row.key);
              setSelectedSid(null);
              setSelectedUnclassified(false);
              setFocusedTimelineItem({type: 'db', key: row.key, index: 0});
            } else if (row && row.type === 'instance' && 'instance' in row && row.instance) {
              setSelectedSid(row.instance.sid);
              setSelectedDb(null);
              setSelectedUnclassified(false);
              setFocusedTimelineItem({type: 'sid', key: String(row.instance.sid), index: 0});
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = Math.max(focusedRowIndex - 1, 0);
          if (focusedRowIndex === 0) {
            // Go back to timeline
            setPanelFocus('timeline');
            // Focus last timeline item
            const timelineItems: Array<{type: 'db' | 'sid', key: string}> = [
              ...Object.keys(dbStates || {}).map(db => ({ type: 'db' as const, key: db })),
              ...addresses.flatMap(addr => (groupsByAddress[addr] || []).map(sid => ({ type: 'sid' as const, key: sid })))
            ];
            if (timelineItems.length > 0) {
              const lastItem = timelineItems[timelineItems.length - 1];
              if (lastItem) {
                setFocusedTimelineItem({type: lastItem.type, key: lastItem.key, index: 0});
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
            setFocusedRowIndex(newIndex);
            if (newIndex >= 0 && newIndex < allTableRows.length) {
              const row = allTableRows[newIndex];
              if (row && row.type === 'db') {
                setSelectedDb(row.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
                setFocusedTimelineItem({type: 'db', key: row.key, index: 0});
              } else if (row && row.type === 'instance' && 'instance' in row && row.instance) {
                setSelectedSid(row.instance.sid);
                setSelectedDb(null);
                setSelectedUnclassified(false);
                setFocusedTimelineItem({type: 'sid', key: String(row.instance.sid), index: 0});
              }
            }
          }
        } else if (e.key === 'ArrowRight' && (selectedSid !== null || selectedDb !== null || selectedUnclassified)) {
          e.preventDefault();
          setPanelFocus('events');
          setFocusedEventIndex(0);
        }
      } else if (panelFocus === 'events') {
        // Get current event list
        let eventCount = 0;
        if (selectedUnclassified) {
          eventCount = unclassifiedEvents.length;
        } else if (selectedDb !== null) {
          // Count all database events (state events + specific events)
          const dbStateEvents = dbStates[selectedDb] || [];
          const dbSpecificEvents = databaseEvents.filter((e: any) => {
            const msg = e.message ?? '';
            const raw = e.raw ?? '';
            return msg.includes(selectedDb) || raw.includes(selectedDb);
          });
          eventCount = dbStateEvents.length + dbSpecificEvents.length;
        } else if (selectedSid !== null) {
          const instsForSid = rowsBySid[String(selectedSid)] || [];
          const related = events.filter((e: any) => {
            // Exact match for events with a startId
            if (e.sid === selectedSid) return true;
            // Include events without a startId if they fall within the process's lifetime
            if (e.sid === null && instsForSid.length > 0) {
              return instsForSid.some(inst => e.ts >= inst.start && e.ts <= inst.end);
            }
            return false;
          });
          const frpForSid = failureProtocols.filter(frp => frp.sid === selectedSid);
          eventCount = related.length + frpForSid.length;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = Math.min(focusedEventIndex + 1, eventCount - 1);
          setFocusedEventIndex(newIndex);
          // Scroll focused event into view
          setTimeout(() => {
            const focusedEl = (document as any).querySelector('.event-item.focused');
            if (focusedEl) focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 10);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = Math.max(focusedEventIndex - 1, 0);
          setFocusedEventIndex(newIndex);
          // Scroll focused event into view
          setTimeout(() => {
            const focusedEl = (document as any).querySelector('.event-item.focused');
            if (focusedEl) focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 10);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setPanelFocus('table');
        }
      }
    };
    (document as any).addEventListener('keydown', handleKeyDown);
    return () => (document as any).removeEventListener('keydown', handleKeyDown);
  }, [focusedRowIndex, focusedEventIndex, focusedTimelineItem, panelFocus, allTableRows, selectedSid, selectedDb, selectedUnclassified, dbStates, databaseEvents, events, failureProtocols, rowsBySid, addresses, groupsByAddress, hasUnclassified]);

  return (
    <div className="app">
      <Controls
        loadMode={loadMode}
        setLoadMode={setLoadMode}
        path={path}
        setPath={setPath}
        loading={loading}
        onLoad={load}
        selectedTicket={selectedTicket}
        setSelectedTicket={setSelectedTicket}
        zdTickets={zdTickets}
        selectedPackage={selectedPackage}
        setSelectedPackage={setSelectedPackage}
        diagnosePackages={diagnosePackages}
        theme={theme}
        setTheme={setTheme}
      />

      <ServerTimeline
        loadMode={loadMode}
        selectedPackage={selectedPackage}
        serverTimeRanges={serverTimeRanges}
        selectedServer={selectedServer}
        setSelectedServer={setSelectedServer}
        apsCollapsed={apsCollapsed}
        setApsCollapsed={setApsCollapsed}
        setHoveredBar={setHoveredBar}
        setMousePos={setMousePos}
      />

      <LoadingSpinner visible={loading && loadMode === 'nuosupport'} />

      {/* Main content - hidden when loading */}
      {(!loading || loadMode !== 'nuosupport') && (
      <div className="timeline" onMouseMove={(e: any) => setMousePos({x: e.clientX, y: e.clientY})}>
        <DatabaseTimeline
          dbStates={dbStates}
          events={events}
          gStart={gStart}
          gEnd={gEnd}
          cursorX={cursorX}
          setCursorX={setCursorX}
          focusedTimelineItem={focusedTimelineItem}
          setFocusedTimelineItem={setFocusedTimelineItem}
          setPanelFocus={setPanelFocus}
          setSelectedDb={setSelectedDb}
          setSelectedSid={setSelectedSid}
          setHoveredBar={setHoveredBar}
        />
        
        <UnclassifiedEventsRow
          unclassifiedEvents={unclassifiedEvents}
          gStart={gStart}
          gEnd={gEnd}
          selectedUnclassified={selectedUnclassified}
          setSelectedUnclassified={setSelectedUnclassified}
          setSelectedSid={setSelectedSid}
          setSelectedDb={setSelectedDb}
          setPanelFocus={setPanelFocus}
          setFocusedTimelineItem={setFocusedTimelineItem}
          setHoveredBar={setHoveredBar}
        />
        
        <FilterBar
          filterType={filterType}
          setFilterType={setFilterType}
          filterServers={filterServers}
          setFilterServers={setFilterServers}
          filterSids={filterSids}
          setFilterSids={setFilterSids}
          typeOptions={typeOptions}
          allServers={allServers}
          allSids={allSids}
          serverDropdownOpen={serverDropdownOpen}
          setServerDropdownOpen={setServerDropdownOpen}
          sidDropdownOpen={sidDropdownOpen}
          setSidDropdownOpen={setSidDropdownOpen}
        />
        
        <ProcessTimeline
          addresses={addresses}
          groupsByAddress={groupsByAddress}
          rowsBySid={rowsBySid}
          allRowsBySid={allRowsBySid}
          events={events}
          failureProtocols={failureProtocols}
          gStart={gStart}
          gEnd={gEnd}
          globalEnd={globalEnd}
          cursorX={cursorX}
          setCursorX={setCursorX}
          focusedTimelineItem={focusedTimelineItem}
          setFocusedTimelineItem={setFocusedTimelineItem}
          setPanelFocus={setPanelFocus}
          setSelectedSid={setSelectedSid}
          setSelectedDb={setSelectedDb}
          setSelectedUnclassified={setSelectedUnclassified}
          setHoveredBar={setHoveredBar}
        />

        <Tooltip hoveredBar={hoveredBar} mousePos={mousePos} />

        <RangeSlider
          globalStart={globalStart}
          globalEnd={globalEnd}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          setRangeStart={setRangeStart}
          setRangeEnd={setRangeEnd}
          dragging={dragging}
          setDragging={setDragging}
          setDragStartX={setDragStartX}
          setDragStartRange={setDragStartRange}
          allRowsBySid={allRowsBySid}
          dbStates={dbStates}
        />

        <LogPanel
          selectedSid={selectedSid}
          selectedDb={selectedDb}
          selectedUnclassified={selectedUnclassified}
          setSelectedSid={setSelectedSid}
          setSelectedDb={setSelectedDb}
          setSelectedUnclassified={setSelectedUnclassified}
          unclassifiedEvents={unclassifiedEvents}
          databaseEvents={databaseEvents}
          events={events}
          dbStates={dbStates}
          failureProtocols={failureProtocols}
          rowsBySid={rowsBySid}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          setPanelFocus={setPanelFocus}
          loadedServer={loadedServer}
        />
      </div>
      )}
    </div>
  );
}

//@ts-ignore
assert(document);
//@ts-ignore
const root = createRoot(document.getElementById('root')!);
root.render(<StackApp />);
