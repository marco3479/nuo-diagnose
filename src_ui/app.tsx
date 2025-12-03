import React, { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import assert from '../assert';

declare const fetch: any;
declare const document: any;
declare const window: any;

type Instance = { process: string; sid: number; start: number; end: number; firstIso?: string; lastIso?: string; type?: string; address?: string };
type DbSeg = { state: string; start: number; end: number; iso: string; message: string };
type DbStates = Record<string, DbSeg[]>;
type FailureProtocol = { dbName: string; sid: number; node: number; iteration: number; ts: number; iso: string; message: string; raw: string };
type ServerTimeRange = { server: string; start: number; end: number; startIso: string; endIso: string };

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

function StackApp(): JSX.Element {
  const [path, setPath] = useState('tests/mock/nuoadmin.log');
  // Detect initial mode from URL - default to nuosupport unless explicitly at root with file mode
  const initialMode = window.location.pathname === '/' || window.location.pathname.startsWith('/nuosupport') ? 'nuosupport' : 'file';
  const [loadMode, setLoadMode] = useState<'file' | 'nuosupport'>(initialMode);
  const [zdTickets, setZdTickets] = useState<string[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [diagnosePackages, setDiagnosePackages] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [servers, setServers] = useState<string[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [serverTimeRanges, setServerTimeRanges] = useState<ServerTimeRange[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [events, setEvents] = useState<any[]>([]);
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
  const [sortKey, setSortKey] = useState<'sid' | 'type' | 'address' | 'start' | 'end'>('sid');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'range' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartRange, setDragStartRange] = useState<{start: number, end: number}>({start: 0, end: 0});
  const [rangeBarHover, setRangeBarHover] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const [focusedEventIndex, setFocusedEventIndex] = useState<number>(-1);
  const [panelFocus, setPanelFocus] = useState<'timeline' | 'table' | 'events'>('timeline');
  const [focusedTimelineItem, setFocusedTimelineItem] = useState<{type: 'ap' | 'unclassified' | 'db' | 'sid', key: string, index: number} | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{type: 'process' | 'db' | 'frp', id: string, content: string} | null>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [apsCollapsed, setApsCollapsed] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [sidDropdownOpen, setSidDropdownOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as any;
      if (serverDropdownOpen && target && target.closest && !target.closest('.server-dropdown-container')) {
        setServerDropdownOpen(false);
      }
      if (sidDropdownOpen && target && target.closest && !target.closest('.sid-dropdown-container')) {
        setSidDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [serverDropdownOpen, sidDropdownOpen]);

  // Update URL to /nuosupport if at root and in nuosupport mode
  useEffect(() => {
    if (loadMode === 'nuosupport' && window.location.pathname === '/') {
      window.history.replaceState({}, '', '/nuosupport');
    }
  }, [loadMode]);

  async function load(p = path) {
    setLoading(true);
    try {
      const res = await fetch(`/events.json?path=${encodeURIComponent(p)}`);
      const json = await res.json();
      const insts: Instance[] = (json.instances || []).map((i: any) => ({ process: i.process, sid: i.sid, start: i.start, end: i.end, firstIso: i.firstIso, lastIso: i.lastIso, type: i.type, address: i.address }));
      setInstances(insts.sort((a, b) => a.start - b.start));
      setEvents(json.events || []);
      setDbStates(json.dbStates || {});
      setFailureProtocols(json.failureProtocols || []);
      setLoadedServer('');
      if (json.range && json.range.start && json.range.end) {
        setGlobalStart(json.range.start); setGlobalEnd(json.range.end);
        setRangeStart(json.range.start); setRangeEnd(json.range.end);
      } else if (insts.length) {
        const firstInst = insts[0]!;
        const lastInst = (insts[insts.length - 1] ?? insts[0])!;
        setGlobalStart(firstInst.start); setGlobalEnd((lastInst.end ?? lastInst.start));
        setRangeStart(firstInst.start); setRangeEnd((lastInst.end ?? lastInst.start));
      }
    } catch (e) {
      console.error(e);
    } finally { setLoading(false) }
  }

  async function loadFromNuoSupport() {
    if (!selectedTicket || !selectedPackage || !selectedServer) return;
    setLoading(true);
    try {
      const res = await fetch(`/load-diagnose?ticket=${encodeURIComponent(selectedTicket)}&package=${encodeURIComponent(selectedPackage)}&server=${encodeURIComponent(selectedServer)}`);
      const json = await res.json();
      if (json.error) {
        console.error(json.error);
        alert(`Error: ${json.error}`);
        return;
      }
      const insts: Instance[] = (json.instances || []).map((i: any) => ({ process: i.process, sid: i.sid, start: i.start, end: i.end, firstIso: i.firstIso, lastIso: i.lastIso, type: i.type, address: i.address }));
      setInstances(insts.sort((a, b) => a.start - b.start));
      setEvents(json.events || []);
      setDbStates(json.dbStates || {});
      setFailureProtocols(json.failureProtocols || []);
      setLoadedServer(json.server || selectedServer);
      if (json.range && json.range.start && json.range.end) {
        setGlobalStart(json.range.start); setGlobalEnd(json.range.end);
        setRangeStart(json.range.start); setRangeEnd(json.range.end);
      } else if (insts.length) {
        const firstInst = insts[0]!;
        const lastInst = (insts[insts.length - 1] ?? insts[0])!;
        setGlobalStart(firstInst.start); setGlobalEnd((lastInst.end ?? lastInst.start));
        setRangeStart(firstInst.start); setRangeEnd((lastInst.end ?? lastInst.start));
      }
    } catch (e) {
      console.error(e);
      alert(`Error loading diagnose: ${e}`);
    } finally { setLoading(false) }
  }

  // Load ZD tickets on mount and parse URL parameters
  useEffect(() => {
    // Parse URL parameters like /nuosupport/zd12345/diagnose-20231201/server01
    const urlPath = window.location.pathname;
    // Match patterns: /nuosupport/:ticket, /nuosupport/:ticket/:package, or /nuosupport/:ticket/:package/:server
    const fullMatch = urlPath.match(/\/nuosupport\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    const packageMatch = urlPath.match(/\/nuosupport\/([^\/]+)\/([^\/]+)$/);
    const ticketMatch = urlPath.match(/\/nuosupport\/([^\/]+)$/);
    
    console.log('Fetching ZD tickets...');
    fetch('/list-tickets')
      .then((res: any) => {
        console.log('Tickets response status:', res.status);
        return res.json();
      })
      .then((json: any) => {
        console.log('Tickets data:', json);
        if (json.tickets) {
          console.log(`Found ${json.tickets.length} tickets`);
          setZdTickets(json.tickets);
          
          // If URL has parameters, set them
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
        } else if (json.error) {
          console.error('Error from server:', json.error);
        }
      })
      .catch((e: any) => console.error('Failed to load tickets:', e));
  }, []);

  // Load diagnose packages when ticket selected
  useEffect(() => {
    if (!selectedTicket) {
      setDiagnosePackages([]);
      setSelectedPackage('');
      return;
    }
    
    // Clear selected package first to avoid fetching with stale values
    setSelectedPackage('');
    setSelectedServer('');
    setServers([]);
    setServerTimeRanges([]);
    
    // Update URL when ticket is selected (skip if we're loading from URL initially)
    if (loadMode === 'nuosupport' && !(window as any).__initialPackage) {
      window.history.pushState({}, '', `/nuosupport/${selectedTicket}`);
    }
    
    fetch(`/list-diagnose-packages?ticket=${encodeURIComponent(selectedTicket)}`)
      .then((res: any) => res.json())
      .then((json: any) => {
        if (json.packages) {
          setDiagnosePackages(json.packages);
          // Check if we have a package from URL
          const initialPkg = (window as any).__initialPackage;
          if (initialPkg && json.packages.includes(initialPkg)) {
            setSelectedPackage(initialPkg);
            delete (window as any).__initialPackage;
          } else if (json.packages.length > 0) {
            setSelectedPackage(json.packages[0]);
          }
        }
      })
      .catch((e: any) => console.error('Failed to load packages:', e));
  }, [selectedTicket]);

  // Load servers when package selected
  useEffect(() => {
    if (!selectedTicket || !selectedPackage) {
      setServers([]);
      setSelectedServer('');
      setServerTimeRanges([]);
      return;
    }
    
    // Validate that the selected package belongs to the current ticket
    if (!diagnosePackages.includes(selectedPackage)) {
      console.log('Skipping server fetch - package not in current ticket');
      return;
    }
    
    // Update URL when package is selected (skip if we're loading from URL initially)
    if (loadMode === 'nuosupport' && !(window as any).__initialServer) {
      window.history.pushState({}, '', `/nuosupport/${selectedTicket}/${selectedPackage}`);
    }
    
    // Reset selected server when package changes
    setSelectedServer('');
    setServers([]);
    setServerTimeRanges([]);
    setLoading(true);
    
    // Load server time ranges for timeline visualization
    console.log('Fetching server time ranges for:', selectedTicket, selectedPackage);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error('Server time ranges fetch timed out after 30s');
    }, 30000); // 30 second timeout
    
    fetch(`/server-time-ranges?ticket=${encodeURIComponent(selectedTicket)}&package=${encodeURIComponent(selectedPackage)}`, {
      signal: controller.signal
    })
      .then((res: any) => {
        clearTimeout(timeoutId);
        console.log('Server time ranges response status:', res.status);
        return res.json();
      })
      .then((json: any) => {
        console.log('Server time ranges data:', json);
        setLoading(false);
        if (json.error) {
          console.error('Server time ranges error:', json.error);
          // Don't show alert, just log the error
          return;
        }
        if (json.serverRanges) {
          console.log(`Loaded ${json.serverRanges.length} server ranges`);
          setServerTimeRanges(json.serverRanges);
          const servers = json.serverRanges.map((r: ServerTimeRange) => r.server);
          setServers(servers);
          // Check if we have a server from URL
          const initialServer = (window as any).__initialServer;
          if (initialServer && servers.includes(initialServer)) {
            setSelectedServer(initialServer);
            delete (window as any).__initialServer;
          } else if (servers.length > 0) {
            // Select first server by default
            setSelectedServer(servers[0]);
          }
        }
      })
      .catch((e: any) => {
        clearTimeout(timeoutId);
        setLoading(false);
        if (e.name === 'AbortError') {
          console.error('Server time ranges fetch was aborted (timeout)');
          // Don't show alert for timeout
        } else {
          console.error('Failed to load server time ranges:', e);
          // Don't show alert, just log
        }
      });
  }, [selectedTicket, selectedPackage, diagnosePackages]);

  // Automatically load when server is selected
  useEffect(() => {
    if (selectedServer && selectedTicket && selectedPackage && loadMode === 'nuosupport') {
      // Update URL to match current selection
      const newPath = `/nuosupport/${selectedTicket}/${selectedPackage}/${selectedServer}`;
      window.history.pushState({}, '', newPath);
      loadFromNuoSupport();
    }
  }, [selectedServer]);

  const span = Math.max(1, (rangeEnd ?? globalEnd) - (rangeStart ?? globalStart));
  const gStart = rangeStart ?? globalStart;
  const gEnd = rangeEnd ?? globalEnd;

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
  }, [dragging, globalStart, globalEnd, rangeStart, rangeEnd]);

  // visible instances intersecting selection
  // For processes without RemoveNodeCommand, they're still running so check against globalEnd
  const visible = instances.filter(i => {
    const removeEvents = events.filter((e: any) => {
      return e.sid === i.sid && /RemoveNodeCommand/.test(e.message ?? '');
    });
    const effectiveEnd = removeEvents.length > 0 ? i.end : globalEnd;
    return effectiveEnd >= gStart && i.start <= gEnd;
  });

  // Build filter options (types list) - use all instances for filter options
  const allRowsBySid: Record<string, Instance[]> = {};
  for (const inst of instances) {
    const key = String(inst.sid);
    (allRowsBySid[key] ||= []).push(inst);
  }
  const instanceType = (i: Instance): string => i.type ?? (allRowsBySid[String(i.sid)]?.find(x => x.type)?.type) ?? '';
  const typeOptions = Array.from(new Set(instances.map(instanceType).filter(Boolean))).sort();
  const allServers = Array.from(new Set(instances.map(i => i.address).filter(Boolean) as string[])).sort();
  const allSids = Array.from(new Set(instances.map(i => String(i.sid)))).sort((a, b) => Number(a) - Number(b));
  // Apply filters
  const filtered = visible.filter(i => {
    const t = instanceType(i);
    if (filterType !== 'ALL' && t !== filterType) return false;
    // Empty filterServers means ALL servers (default behavior)
    if (filterServers.size > 0 && !filterServers.has(i.address ?? '')) return false;
    // Empty filterSids means ALL sids (default behavior)
    if (filterSids.size > 0 && !filterSids.has(String(i.sid))) return false;
    return true;
  });

  // Group filtered rows by sid for timeline display
  const rowsBySid: Record<string, Instance[]> = {};
  for (const inst of filtered) {
    const key = String(inst.sid);
    (rowsBySid[key] ||= []).push(inst);
  }

  // Sorting
  const comparator = (a: Instance, b: Instance) => {
    let va: any; let vb: any;
    switch (sortKey) {
      case 'sid': va = a.sid; vb = b.sid; break;
      case 'type': va = instanceType(a); vb = instanceType(b); break;
      case 'address': va = a.address ?? ''; vb = b.address ?? ''; break;
      case 'start': va = a.start; vb = b.start; break;
      case 'end': va = a.end; vb = b.end; break;
    }
    if (typeof va === 'string' && typeof vb === 'string') {
      const c = va.localeCompare(vb);
      return sortDir === 'asc' ? c : -c;
    }
    const c = (va ?? 0) - (vb ?? 0);
    return sortDir === 'asc' ? c : -c;
  };
  const visibleSorted = filtered.slice().sort(comparator);

  // Classify all events into process, database, or unclassified categories
  const processEvents: any[] = [];
  const databaseEvents: any[] = [];
  const unclassifiedEvents: any[] = [];
  
  for (const e of events) {
    const msg = e.message ?? '';
    const raw = e.raw ?? '';
    
    // Check if it's a process event (has startId, start-id, or sid parameters)
    const hasProcessId = /\b(?:startIds?|start-id|sid)[:=]/.test(msg) || /\b(?:startIds?|start-id|sid)[:=]/.test(raw);
    if (hasProcessId) {
      processEvents.push(e);
      continue;
    }
    
    // Check if it's a database event
    // 1. Has dbName parameter
    const hasDatabaseName = /\bdbName[:=]/.test(msg) || /\bdbName[:=]/.test(raw);
    if (hasDatabaseName) {
      databaseEvents.push(e);
      continue;
    }
    
    // 2. DomainProcessStateMachine events that mention any known database name
    const isDomainProcessStateMachine = /DomainProcessStateMachine/.test(msg) || /DomainProcessStateMachine/.test(raw);
    if (isDomainProcessStateMachine) {
      const mentionsAnyDb = Object.keys(dbStates || {}).some(db => msg.includes(db) || raw.includes(db));
      if (mentionsAnyDb) {
        databaseEvents.push(e);
        continue;
      }
    }
    
    // Everything else is unclassified
    unclassifiedEvents.push(e);
  }
  
  const hasUnclassified = unclassifiedEvents.length > 0;
  const allTableRows = [
    ...(hasUnclassified ? [{ type: 'unclassified' as const, key: 'unclassified' }] : []),
    ...Object.keys(dbStates || {}).map(db => ({ type: 'db' as const, key: db })), 
    ...visibleSorted.map((inst, idx) => ({ type: 'instance' as const, key: `inst-${idx}`, instance: inst }))
  ];

  const toggleSort = (key: 'sid' | 'type' | 'address' | 'start' | 'end') => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Now group sids by their reported address so sids that share the same address are shown together
  const groupsByAddress: Record<string, string[]> = {};
  for (const [sid, insts] of Object.entries(rowsBySid)) {
    const addr = (insts[0] && insts[0].address) ? insts[0].address! : 'unknown';
    (groupsByAddress[addr] ||= []).push(sid);
  }
  // Sort address groups by the earliest instance start time within that address
  const addresses = Object.keys(groupsByAddress).sort((a, b) => {
    const aSids = groupsByAddress[a] || [];
    const bSids = groupsByAddress[b] || [];
    const aStarts = aSids.flatMap(sid => (rowsBySid[sid] || []).map(i => i.start));
    const bStarts = bSids.flatMap(sid => (rowsBySid[sid] || []).map(i => i.start));
    const aMin = aStarts.length ? Math.min(...aStarts) : Infinity;
    const bMin = bStarts.length ? Math.min(...bStarts) : Infinity;
    return aMin - bMin;
  });

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
      <div className="controls">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, width: '100%' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Load from:
            <select value={loadMode} onChange={(e: any) => setLoadMode(e.target.value)}>
              <option value="nuosupport">nuosupport</option>
              <option value="file">file path</option>
            </select>
          </label>
        
        {loadMode === 'file' ? (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Log path:
              <input type="text" value={path} onChange={(e: any) => setPath(e.target.value)} style={{ width: 360 }} />
            </label>
            <button onClick={() => load()} disabled={loading}>Load</button>
          </>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              ZD Ticket:
              <select value={selectedTicket} onChange={(e: any) => setSelectedTicket(e.target.value)} style={{ minWidth: 120 }}>
                <option value="">Select ticket...</option>
                {zdTickets.slice().reverse().map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Diagnose Package:
              <select value={selectedPackage} onChange={(e: any) => setSelectedPackage(e.target.value)} style={{ minWidth: 200 }} disabled={!selectedTicket}>
                <option value="">Select package...</option>
                {diagnosePackages.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            {loading && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</span>}
          </>
        )}
        
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{ marginLeft: 'auto', justifySelf: 'flex-end', fontSize: 16 }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? '◐' : '◑'}
        </button>
      </div>
      
    </div>

      {/* Server Timeline - shown when package is selected in NuoSupport mode */}
      {loadMode === 'nuosupport' && selectedPackage && (
        <div style={{ marginBottom: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: 12 }}>
          <div 
            style={{ fontSize: 13, fontWeight: 600, marginBottom: apsCollapsed && selectedServer ? 8 : (apsCollapsed ? 0 : 8), color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setApsCollapsed(!apsCollapsed)}
          >
            <span style={{ fontSize: 11, transform: apsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
            Logs from servers
          </div>
          {apsCollapsed && selectedServer && (() => {
            const allStarts = serverTimeRanges.map(r => r.start);
            const allEnds = serverTimeRanges.map(r => r.end);
            const minTs = Math.min(...allStarts);
            const maxTs = Math.max(...allEnds);
            const timeSpan = maxTs - minTs || 1;
            const selectedRange = serverTimeRanges.find(r => r.server === selectedServer);
            if (!selectedRange) return null;
            
            const left = ((selectedRange.start - minTs) / timeSpan) * 100;
            const width = ((selectedRange.end - selectedRange.start) / timeSpan) * 100;
            
            return (
              <div style={{ position: 'relative' }}>
                {/* Time axis labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-hint)', marginBottom: 4, paddingLeft: 200, paddingRight: 8 }}>
                  <span>{new Date(minTs).toISOString().replace('T', ' ').substring(0, 19)}</span>
                  <span>{new Date(maxTs).toISOString().replace('T', ' ').substring(0, 19)}</span>
                </div>
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setHoveredBar({
                      type: 'process',
                      id: selectedRange.server,
                      content: `${selectedRange.server}\n${selectedRange.startIso} → ${selectedRange.endIso}\nDuration: ${Math.round((selectedRange.end - selectedRange.start) / 1000 / 60)} minutes`
                    });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                >
                  <div style={{ 
                    width: 190, 
                    fontSize: 12, 
                    color: 'var(--accent)',
                    fontWeight: 600,
                    textAlign: 'right',
                    paddingRight: 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedRange.server}
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: 20 }}>
                    <div style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      height: '100%',
                      background: 'hsl(30, 60%, 45%)',
                      borderRadius: 3,
                      border: '2px solid hsl(30, 65%, 40%)',
                      boxShadow: '0 0 8px rgba(160, 100, 40, 0.4)'
                    }} />
                  </div>
                </div>
              </div>
            );
          })()}
          {!apsCollapsed && (serverTimeRanges.length === 0 ? (
            <div style={{ color: 'var(--text-hint)', fontSize: 13, padding: 8 }}>Loading APs...</div>
          ) : (
          (function() {
            const allStarts = serverTimeRanges.map(r => r.start);
            const allEnds = serverTimeRanges.map(r => r.end);
            const minTs = Math.min(...allStarts);
            const maxTs = Math.max(...allEnds);
            const timeSpan = maxTs - minTs || 1;
            
            return (
              <div style={{ position: 'relative' }}>
                {/* Time axis labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-hint)', marginBottom: 4, paddingLeft: 200, paddingRight: 8 }}>
                  <span>{new Date(minTs).toISOString().replace('T', ' ').substring(0, 19)}</span>
                  <span>{new Date(maxTs).toISOString().replace('T', ' ').substring(0, 19)}</span>
                </div>
                
                {/* Server bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {serverTimeRanges.map((range, idx) => {
                    const left = ((range.start - minTs) / timeSpan) * 100;
                    const width = ((range.end - range.start) / timeSpan) * 100;
                    const isSelected = selectedServer === range.server;
                    
                    return (
                      <div 
                        key={range.server}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onClick={() => setSelectedServer(range.server)}
                        onMouseEnter={(e) => {
                          setMousePos({ x: e.clientX, y: e.clientY });
                          setHoveredBar({
                            type: 'process',
                            id: range.server,
                            content: `${range.server}\n${range.startIso} → ${range.endIso}\nDuration: ${Math.round((range.end - range.start) / 1000 / 60)} minutes`
                          });
                        }}
                        onMouseLeave={() => setHoveredBar(null)}
                        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                      >
                        <div style={{ 
                          width: 190, 
                          fontSize: 12, 
                          color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 600 : 400,
                          textAlign: 'right',
                          paddingRight: 8,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {range.server}
                        </div>
                        <div style={{ flex: 1, position: 'relative', height: 20 }}>
                          <div style={{
                            position: 'absolute',
                            left: `${left}%`,
                            width: `${width}%`,
                            height: '100%',
                            background: isSelected ? 'hsl(30, 60%, 45%)' : 'hsl(30, 50%, 55%)',
                            borderRadius: 3,
                            border: isSelected ? '2px solid hsl(30, 65%, 40%)' : '1px solid rgba(255, 255, 255, 0.2)',
                            boxShadow: isSelected ? '0 0 8px rgba(160, 100, 40, 0.4)' : 'none',
                            transition: 'all 0.2s ease'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          })()
          ))}
        </div>
      )}

      {/* Loading spinner - shown when loading server data */}
      {loading && loadMode === 'nuosupport' && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '60px 20px',
          color: 'var(--text-muted)',
          fontSize: 14
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              border: '3px solid var(--border-primary)', 
              borderTopColor: 'var(--accent)', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px'
            }} />
            Loading data as per AP...
          </div>
        </div>
      )}

      {/* Main content - hidden when loading */}
      {(!loading || loadMode !== 'nuosupport') && (
      <div className="timeline" onMouseMove={(e: any) => setMousePos({x: e.clientX, y: e.clientY})}>
        {/* Database state row(s) */}
        {Object.keys(dbStates || {}).length > 0 ? (
          <div className="stack-area" style={{ position: 'relative' }} onMouseMove={(e: any) => { const rect = e.currentTarget.getBoundingClientRect(); setCursorX(e.clientX - rect.left); }} onMouseLeave={() => setCursorX(null)}>
            {cursorX !== null && <div style={{ position: 'absolute', left: cursorX, top: 0, bottom: 0, width: 1, background: 'rgba(255, 255, 255, 0.3)', pointerEvents: 'none', zIndex: 100 }} />}
            {Object.entries(dbStates).map(([db, segs]) => {
              return (
                <div key={`db-${db}`} className="stack-row" style={{ opacity: 0.95, cursor: 'pointer', outline: focusedTimelineItem?.type === 'db' && focusedTimelineItem?.key === db ? '2px solid rgba(43, 157, 244, 0.6)' : 'none', outlineOffset: -2 }} onClick={() => { setFocusedTimelineItem({type: 'db', key: db, index: 0}); setPanelFocus('timeline'); setSelectedDb(db); setSelectedSid(null); }}>
                  <div className="stack-label">DB {db}</div>
                  <div className="stack-track">
                    {segs.map((seg, idx) => {
                      const left = ((seg.start - gStart) / (gEnd - gStart)) * 100;
                      const right = ((seg.end - gStart) / (gEnd - gStart)) * 100;
                      const width = Math.max(0.2, right - left);
                      const bg = stateColor(seg.state);
                      const tooltipContent = `${seg.state} — ${seg.iso}\n${seg.message}`;
                      const barId = `db-${db}-${idx}`;
                      return (
                        <div 
                          key={`dbseg-${db}-${idx}`} 
                          className="instance-bar db-bar" 
                          style={{ left: `${left}%`, width: `${width}%`, background: bg, anchorName: `--${barId}` } as any}
                          onMouseEnter={() => setHoveredBar({type: 'db', id: barId, content: tooltipContent})}
                          onMouseLeave={() => setHoveredBar(null)}
                        />
                      )
                    })}
                    {/* Add UpdateDatabaseOptionsCommand events as diamonds */}
                    {/* Add UpdateDatabaseOptionsCommand events as slivers */}
                    {(function() {
                      const dbEvents = events.filter((e: any) => {
                        const msg = e.message ?? '';
                        const raw = e.raw ?? '';
                        // Check if this is an UpdateDatabaseOptionsCommand from DomainProcessStateMachine
                        const isUpdateDbCmd = /UpdateDatabaseOptionsCommand/.test(msg) || /UpdateDatabaseOptionsCommand/.test(raw);
                        const isDomainProcessStateMachine = /DomainProcessStateMachine/.test(msg) || /DomainProcessStateMachine/.test(raw);
                        if (!isUpdateDbCmd || !isDomainProcessStateMachine) return false;
                        
                        // Match if database name appears anywhere in the log (including in JSON/params)
                        const hasDbName = msg.includes(db) || raw.includes(db);
                        // Also match patterns like "name=dbname" or "name\":\"dbname\""
                        const dbNamePattern = new RegExp(`name[=:\s"']+${db}`, 'i');
                        const hasDbInParams = dbNamePattern.test(msg) || dbNamePattern.test(raw);
                        
                        // If this UpdateDatabaseOptionsCommand doesn't match ANY database specifically,
                        // show it on ALL database timelines (it applies to all or DB context is implicit)
                        const matchesAnyDb = Object.keys(dbStates || {}).some(dbName => {
                          return msg.includes(dbName) || raw.includes(dbName) || 
                                 new RegExp(`name[=:\s"']+${dbName}`, 'i').test(msg) ||
                                 new RegExp(`name[=:\s"']+${dbName}`, 'i').test(raw);
                        });
                        
                        return (hasDbName || hasDbInParams) || !matchesAnyDb;
                      }).sort((a: any, b: any) => a.ts - b.ts);
                      
                      // Group events that are very close together (within 0.5% of timeline width)
                      const groupedEvents: Array<{events: any[], left: number}> = [];
                      const groupThreshold = 0.5; // 0.5% of timeline
                      
                      dbEvents.forEach((ev: any) => {
                        const left = ((ev.ts - gStart) / (gEnd - gStart)) * 100;
                        const lastGroup = groupedEvents[groupedEvents.length - 1];
                        
                        if (lastGroup && Math.abs(left - lastGroup.left) < groupThreshold) {
                          // Add to existing group
                          lastGroup.events.push(ev);
                        } else {
                          // Create new group
                          groupedEvents.push({events: [ev], left: left});
                        }
                      });
                      
                      return groupedEvents.map((group, groupIdx) => {
                        const sliverId = `db-${db}-update-group-${groupIdx}`;
                        const tooltipContent = group.events.map(ev => `${ev.iso}\n${ev.raw ?? ev.message}`).join('\n\n---\n\n');
                        const width = group.events.length > 1 ? '3px' : '2px'; // Thicker for groups
                        
                        return (
                          <div 
                            key={sliverId}
                            style={{ 
                              left: `${group.left}%`, 
                              position: 'absolute', 
                              top: '0', 
                              bottom: '0', 
                              width: width, 
                              background: 'hsla(280, 60%, 60%, 0.9)', 
                              zIndex: 10,
                              anchorName: `--${sliverId}` 
                            } as any}
                            onMouseEnter={() => setHoveredBar({type: 'frp', id: sliverId, content: tooltipContent})}
                            onMouseLeave={() => setHoveredBar(null)}
                          />
                        )
                      })
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="stack-area" style={{ marginBottom: 6 }}>
            <div className="stack-row" style={{ height: 20 }}>
              <div className="stack-label">Database</div>
              <div className="stack-track">
                <div className="hint" style={{ position: 'absolute', left: 0 }}>
                  No database state transitions found in this log.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Unclassified events section */}
        {unclassifiedEvents.length > 0 && (
          <div className="stack-area" style={{ marginBottom: 6 }}>
            <div 
              className="stack-row" 
              style={{ 
                opacity: 0.95, 
                cursor: 'pointer', 
                outline: selectedUnclassified ? '2px solid rgba(43, 157, 244, 0.6)' : 'none', 
                outlineOffset: -2 
              }} 
              onClick={() => { 
                setSelectedUnclassified(true);
                setSelectedSid(null);
                setSelectedDb(null);
                setPanelFocus('table');
                setFocusedTimelineItem({type: 'unclassified', key: 'unclassified', index: 0});
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
                      style={{ 
                        left: `${left}%`, 
                        position: 'absolute', 
                        top: '2px', 
                        width: 8, 
                        height: 8, 
                        background: 'hsla(280, 60%, 50%, 0.9)', 
                        transform: 'rotate(45deg)', 
                        zIndex: 10,
                        anchorName: `--${dotId}` 
                      } as any}
                      onMouseEnter={() => setHoveredBar({type: 'frp', id: dotId, content: `${ev.iso}\n${ev.raw ?? ev.message}`})}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {/* Filter bar - positioned between database and processes */}
        <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-primary)', borderBottom: '1px solid var(--border-primary)', marginTop: 12, marginBottom: 12, alignItems: 'center' }}>
          <div className="server-dropdown-container" style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 50 }}>Server:</label>
            <button
              onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
              style={{ 
                padding: '4px 8px', 
                background: 'var(--input-bg)', 
                border: '1px solid var(--input-border)', 
                borderRadius: 4, 
                color: 'var(--text-primary)', 
                fontSize: 12,
                cursor: 'pointer',
                minWidth: 120,
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>{filterServers.size === 0 ? 'ALL' : `${filterServers.size} selected`}</span>
              <span style={{ fontSize: 10 }}>{serverDropdownOpen ? '\u25b2' : '\u25bc'}</span>
            </button>
            {serverDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 50,
                marginTop: 4,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 4,
                padding: 8,
                zIndex: 1000,
                maxHeight: 300,
                overflowY: 'auto',
                minWidth: 200,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3, fontWeight: 600 }}>
                  <input 
                    type="checkbox" 
                    checked={filterServers.size === 0}
                    onChange={(e: any) => {
                      if (e.target.checked) {
                        setFilterServers(new Set());
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>ALL</span>
                </label>
                {allServers.map(server => (
                  <label key={server} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3 }}>
                    <input 
                      type="checkbox" 
                      checked={filterServers.size === 0 || filterServers.has(server)}
                      onChange={(e: any) => {
                        const newSet = new Set(filterServers);
                        if (e.target.checked) {
                          newSet.add(server);
                          if (newSet.size === allServers.length) {
                            setFilterServers(new Set());
                          } else {
                            setFilterServers(newSet);
                          }
                        } else {
                          if (filterServers.size === 0) {
                            const allExceptThis = new Set(allServers.filter(s => s !== server));
                            setFilterServers(allExceptThis);
                          } else {
                            newSet.delete(server);
                            setFilterServers(newSet);
                          }
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{server}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="sid-dropdown-container" style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 30 }}>SID:</label>
            <button
              onClick={() => setSidDropdownOpen(!sidDropdownOpen)}
              style={{ 
                padding: '4px 8px', 
                background: 'var(--input-bg)', 
                border: '1px solid var(--input-border)', 
                borderRadius: 4, 
                color: 'var(--text-primary)', 
                fontSize: 12,
                cursor: 'pointer',
                minWidth: 100,
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>{filterSids.size === 0 ? 'ALL' : `${filterSids.size} selected`}</span>
              <span style={{ fontSize: 10 }}>{sidDropdownOpen ? '\u25b2' : '\u25bc'}</span>
            </button>
            {sidDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 30,
                marginTop: 4,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 4,
                padding: 8,
                zIndex: 1000,
                maxHeight: 300,
                overflowY: 'auto',
                minWidth: 150,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3, fontWeight: 600 }}>
                  <input 
                    type="checkbox" 
                    checked={filterSids.size === 0}
                    onChange={(e: any) => {
                      if (e.target.checked) {
                        setFilterSids(new Set());
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>ALL</span>
                </label>
                {allSids.map(sid => (
                  <label key={sid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3 }}>
                    <input 
                      type="checkbox" 
                      checked={filterSids.size === 0 || filterSids.has(sid)}
                      onChange={(e: any) => {
                        const newSet = new Set(filterSids);
                        if (e.target.checked) {
                          newSet.add(sid);
                          if (newSet.size === allSids.length) {
                            setFilterSids(new Set());
                          } else {
                            setFilterSids(newSet);
                          }
                        } else {
                          if (filterSids.size === 0) {
                            const allExceptThis = new Set(allSids.filter(s => s !== sid));
                            setFilterSids(allExceptThis);
                          } else {
                            newSet.delete(sid);
                            setFilterSids(newSet);
                          }
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{sid}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 40 }}>Type:</label>
            <select 
              value={filterType} 
              onChange={(e: any) => setFilterType(e.target.value)} 
              style={{ padding: '4px 8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
            >
              <option value="ALL">ALL</option>
              {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button 
            onClick={() => { setFilterSids(new Set()); setFilterType('ALL'); setFilterServers(new Set()); }} 
            style={{ padding: '4px 12px', background: 'var(--button-bg)', border: '1px solid var(--button-border)', borderRadius: 4, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
          >
            Reset filters
          </button>
        </div>
        
        <div className="stack-area" style={{ position: 'relative' }} onMouseMove={(e: any) => { const rect = e.currentTarget.getBoundingClientRect(); setCursorX(e.clientX - rect.left); }} onMouseLeave={() => setCursorX(null)}>
          {cursorX !== null && <div style={{ position: 'absolute', left: cursorX, top: 0, bottom: 0, width: 1, background: 'rgba(255, 255, 255, 0.3)', pointerEvents: 'none', zIndex: 100 }} />}
          {addresses.map((addr) => {
            const sids = groupsByAddress[addr] || [];
            return (
              <div key={`group-${addr}`}>
                <div className="stack-row" style={{ opacity: 0.9, fontWeight: 600 }}>
                  <div className="stack-label" style={{ color: "white", fontSize: 10 }}>{addr}</div>
                  <div className="stack-track" />
                </div>
                {sids.map((sid, sidIndexInGroup) => {
                  const procInst = (rowsBySid[sid] || []).sort((a, b) => a.start - b.start);
                  if (procInst.length === 0) return null;
                  
                  const first = procInst[0];
                  // prefer any available type for this sid (some occurrences may have type missing)
                  const anyType = procInst.find(x => x.type && x.type.length > 0)?.type ?? undefined;
                  const label = `${anyType ? anyType + ' - ' : ''}${sid}`;

                  // Determine base color by type: SM=blue, TE=orange, fallback=gray
                  let baseHue = 200; // default gray-blue
                  let baseSat = 50;
                  let baseLit = 48;
                  if (anyType === 'SM') {
                    baseHue = 210; // blue
                    baseSat = 70;
                  } else if (anyType === 'TE') {
                    baseHue = 35; // yellow-orange
                    baseSat = 78;
                  }
                  // Vary hue slightly per sid index in this group (keep TE in 35-50 range to stay yellow-orange)
                    const hueVariation = anyType === 'TE'
                    ? (sidIndexInGroup * 3) % 40 - 7
                    : anyType === 'SM'
                      ? (sidIndexInGroup * 15) % 60 - 30
                      : 0;
                      // Purple if not TE or SM
                      if (!anyType || (anyType !== 'TE' && anyType !== 'SM')) {
                      baseHue = 270;
                      baseSat = 60;
                      baseLit = 50;
                    }
                  const hue = baseHue + hueVariation;

                  // Detect issues for this sid (for border styling)
                  const hasFailureProtocol = failureProtocols.some(frp => frp.sid === Number(sid));
                  const removeEvents = events.filter((e: any) => {
                    return e.sid === Number(sid) && /RemoveNodeCommand/.test(e.message ?? '');
                  });
                  const hasNonGracefulRemoval = removeEvents.some(e => !/Gracefully shutdown engine/i.test(e.message ?? ''));
                  const hasAssert = removeEvents.some(e => {
                    const reasonMatch = e.message?.match(/reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/);
                    return reasonMatch && /ASSERT/i.test(reasonMatch[0]);
                  });
                  const hasIssue = hasFailureProtocol || hasNonGracefulRemoval || hasAssert;
                  const isCritical = hasAssert || hasFailureProtocol;

                  return (
                    <div 
                      key={`sidrow-${sid}`} 
                      className="stack-row layer" 
                      style={{ 
                        cursor: 'pointer', 
                        outline: focusedTimelineItem?.type === 'sid' && focusedTimelineItem?.key === sid ? '2px solid rgba(43, 157, 244, 0.6)' : 'none', 
                        outlineOffset: -2,
                        borderLeft: hasIssue ? (isCritical ? '3px solid #ff0000' : '3px solid #ff8844') : undefined,
                        boxShadow: hasIssue ? (isCritical ? '0 0 8px rgba(255, 0, 0, 0.3)' : '0 0 6px rgba(255, 136, 68, 0.2)') : undefined
                      }} 
                      onClick={() => { setFocusedTimelineItem({type: 'sid', key: sid, index: 0}); setPanelFocus('timeline'); setSelectedSid(Number(sid)); setSelectedDb(null); setSelectedUnclassified(false); }}
                    >
                      <div className="stack-label">
                        {label}
                        {hasAssert && <span style={{ marginLeft: 6, color: '#ff6666', fontSize: 11, fontWeight: 600 }} title="ASSERT detected">⚠</span>}
                        {hasFailureProtocol && <span style={{ marginLeft: 6, color: '#ff4444', fontSize: 11, fontWeight: 600 }} title="Failure Protocol">⚠</span>}
                      </div>
                      <div className="stack-track">
                        {procInst.map((inst, idx) => {
                          // Check for all RemoveNodeCommand events for this sid using the parsed sid field
                          const removeEvents = events.filter((e: any) => {
                            return e.sid === Number(sid) && /RemoveNodeCommand/.test(e.message ?? '');
                          });
                          const hasNonGracefulRemoval = removeEvents.some(e => !/Gracefully shutdown engine/i.test(e.message ?? ''));
                          
                          // If no RemoveNodeCommand found, extend bar to globalEnd (process still running)
                          const effectiveEnd = removeEvents.length > 0 ? inst.end : globalEnd;
                          
                          // Skip rendering if this instance doesn't overlap with visible range
                          const instanceOverlaps = effectiveEnd >= gStart && inst.start <= gEnd;
                          if (!instanceOverlaps) return null;
                          
                          const left = Math.max(0, ((inst.start - gStart) / (gEnd - gStart)) * 100);
                          const right = Math.min(100, ((effectiveEnd - gStart) / (gEnd - gStart)) * 100);
                          const width = Math.max(0.2, right - left);
                          // Vary lightness per instance within the same sid
                          const lit = baseLit + (idx * 8) % 20 - 10;
                          const style: any = { left: `${left}%`, width: `${width}%`, background: `hsl(${hue}deg ${baseSat}% ${lit}%)` };
                          
                          // Build tooltip with instance info and RemoveNodeCommand events
                          let tooltipContent = `sid=${inst.sid} ${inst.firstIso ?? ''} → ${removeEvents.length > 0 ? (inst.lastIso ?? '') : 'still running'}`;
                          if (removeEvents.length > 0) {
                            tooltipContent += '\n\nRemoveNodeCommand events:';
                            removeEvents.forEach(e => {
                              tooltipContent += `\n${e.iso ?? ''}: ${e.message ?? ''}`;
                            });
                          } else {
                            tooltipContent += '\n\n(No RemoveNodeCommand found - process still running)';
                          }
                          
                          const barId = `bar-${sid}-${idx}`;
                          
                          return (
                            <div key={`${sid}-${inst.sid}-${idx}`} style={{ position: 'relative', left: `${left}%`, width: `${width}%`, height: '100%' }}>
                              <div 
                                className="instance-bar" 
                                style={{ width: '100%', height: '100%', background: `hsl(${hue}deg ${baseSat}% ${lit}%)`, anchorName: `--${barId}` } as any}
                                onMouseEnter={() => setHoveredBar({type: 'process', id: barId, content: tooltipContent})}
                                onMouseLeave={() => setHoveredBar(null)}
                              />
                              {hasNonGracefulRemoval && (
                                <div style={{ position: 'absolute', right: 0, top: '0', bottom: '0', width: "1.5px", background: '#ff4444', borderRadius: '0 2px 2px 0', zIndex: 5, pointerEvents: 'none' }} />
                              )}
                            </div>
                          );
                        })}
                        {/* Overlay failure protocol events for this sid */}
                        {failureProtocols.filter(frp => frp.sid === Number(sid)).map((frp, idx) => {
                          const left = ((frp.ts - gStart) / (gEnd - gStart)) * 100;
                          const tooltipContent = frp.raw.replace(/^(\S+)\s+/, '$1\n');
                          const frpId = `frp-${sid}-${idx}`;
                          return (
                            <div 
                              key={frpId} 
                              className="frp-dot" 
                              style={{ left: `${left}%`, position: 'absolute', top: '2px', width: 10, height: 10, background: 'hsla(336, 68%, 38%, 1.00)', transform: 'rotate(45deg)', zIndex: 10, anchorName: `--${frpId}` } as any}
                              onMouseEnter={() => setHoveredBar({type: 'frp', id: frpId, content: tooltipContent})}
                              onMouseLeave={() => setHoveredBar(null)}
                            />
                          );
                        })}
                        {/* ASSERT events from RemoveNodeCommand - red glowing markers */}
                        {(function() {
                          const assertEvents = events.filter((e: any) => {
                            const msg = e.message ?? '';
                            const sidMatch = new RegExp(`\\bstartId=${sid}\\b`, 'i').test(msg);
                            const isRemoveNode = /RemoveNodeCommand/.test(msg);
                            const reasonMatch = isRemoveNode ? msg.match(/reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/) : null;
                            const hasAssert = reasonMatch && /ASSERT/i.test(reasonMatch[0]);
                            return sidMatch && hasAssert;
                          }).sort((a: any, b: any) => a.ts - b.ts);
                          
                          // Group events that are very close together (within 0.5% of timeline width)
                          const groupedEvents: Array<{events: any[], left: number}> = [];
                          const groupThreshold = 0.5;
                          
                          assertEvents.forEach((ev: any) => {
                            const left = ((ev.ts - gStart) / (gEnd - gStart)) * 100;
                            const lastGroup = groupedEvents[groupedEvents.length - 1];
                            
                            if (lastGroup && Math.abs(left - lastGroup.left) < groupThreshold) {
                              lastGroup.events.push(ev);
                            } else {
                              groupedEvents.push({events: [ev], left: left});
                            }
                          });
                          
                          return groupedEvents.map((group, groupIdx) => {
                            const assertId = `assert-${sid}-${groupIdx}`;
                            const tooltipContent = group.events.map(ev => `${ev.iso}\n${ev.message ?? ev.raw}`).join('\n\n---\n\n');
                            const size = group.events.length > 1 ? 12 : 10;
                            
                            return (
                              <div 
                                key={assertId}
                                className="frp-dot"
                                style={{ 
                                  left: `${group.left}%`, 
                                  position: 'absolute', 
                                  top: '2px', 
                                  width: size, 
                                  height: size, 
                                  background: '#ff0000',
                                  transform: 'rotate(45deg)', 
                                  zIndex: 11,
                                  boxShadow: '0 0 8px 2px rgba(255, 0, 0, 0.6)',
                                  animation: 'pulse-red 2s ease-in-out infinite',
                                  anchorName: `--${assertId}` 
                                } as any}
                                onMouseEnter={() => setHoveredBar({type: 'frp', id: assertId, content: tooltipContent})}
                                onMouseLeave={() => setHoveredBar(null)}
                              />
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Popover for timeline bars */}
        {hoveredBar && (
          <div 
            style={{
              position: 'fixed',
              left: Math.min(mousePos.x + 12, window.innerWidth - 620),
              top: Math.min(mousePos.y + 12, window.innerHeight - 200),
              background: 'var(--popover-bg)',
              border: '1px solid var(--popover-border)',
              borderRadius: 6,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              zIndex: 1000,
              maxWidth: 600,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              pointerEvents: 'none'
            }}
          >
            {hoveredBar.content}
          </div>
        )}

        {/* Double-handle range slider with minimap */}
        <div style={{ display: 'flex', marginTop: 8, marginBottom: 12 }}>
          <div style={{ width: 'var(--label-width)', flexShrink: 0 }} />
          <div className="range-slider-track" style={{ flex: 1, position: 'relative', height: 80 }}>
            {/* Minimap background */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, background: 'var(--bg-secondary)', borderRadius: 4, border: '1px solid var(--border-secondary)' }}>
              {/* Database states minimap */}
              {Object.keys(dbStates || {}).map((dbName, dbIdx) => {
                const segments = dbStates[dbName] || [];
                return segments.map((seg: any, segIdx: number) => {
                  const left = ((seg.start - globalStart) / (globalEnd - globalStart)) * 100;
                  const width = ((seg.end - seg.start) / (globalEnd - globalStart)) * 100;
                  const colors = {'NOT_RUNNING': '#555', 'STARTING': '#ffdd99', 'RUNNING': '#90ee90', 'STOPPED': '#ff6666', 'FAILED': '#ff4444'};
                  const color = (colors as any)[seg.state] || '#888';
                  return (
                    <div 
                      key={`${dbName}-${segIdx}`}
                      style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: dbIdx * 3, height: 2, background: color, opacity: 0.6 }}
                    />
                  );
                });
              })}
              {/* Process instances minimap */}
              {Object.keys(allRowsBySid).map((sidKey, sidIdx) => {
                const instances = allRowsBySid[sidKey];
                return instances.map((inst, instIdx) => {
                  const left = ((inst.start - globalStart) / (globalEnd - globalStart)) * 100;
                  const width = ((inst.end - inst.start) / (globalEnd - globalStart)) * 100;
                  const typeColor = instanceType(inst) === 'TE' ? '#6eb5ff' : instanceType(inst) === 'SM' ? '#ffa500' : '#9966ff';
                  return (
                    <div 
                      key={`${sidKey}-${instIdx}`}
                      style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 20 + (sidIdx % 35), height: 1, background: typeColor, opacity: 0.5 }}
                    />
                  );
                });
              })}
            </div>
            {/* Range selection overlay */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, pointerEvents: 'none' }}>
              <div 
                style={{ position: 'absolute', left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`, right: `${100 - ((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%`, height: '100%', background: 'rgba(46, 204, 113, 0.15)', border: '2px solid rgba(46, 204, 113, 0.6)', borderRadius: 4, pointerEvents: 'all', cursor: 'grab' }}
                onMouseEnter={() => setRangeBarHover(true)}
                onMouseLeave={() => setRangeBarHover(false)}
                onMouseDown={(e: any) => { e.preventDefault(); setDragging('range'); setDragStartX(e.clientX); setDragStartRange({start: gStart, end: gEnd}); }}
              />
            </div>
            {/* Handles */}
            <div
              style={{ position: 'absolute', left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`, top: 22, width: 16, height: 16, background: 'var(--range-handle-bg)', border: '3px solid var(--accent)', borderRadius: '50%', cursor: 'ew-resize', zIndex: 3, transform: 'translateX(-50%)' }}
              onMouseDown={(e) => { e.preventDefault(); setDragging('start'); }}
            />
            <div
              style={{ position: 'absolute', left: `${((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%`, top: 22, width: 16, height: 16, background: 'var(--range-handle-bg)', border: '3px solid var(--accent)', borderRadius: '50%', cursor: 'ew-resize', zIndex: 3, transform: 'translateX(-50%)' }}
              onMouseDown={(e) => { e.preventDefault(); setDragging('end'); }}
            />
            {/* Time labels */}
            <div style={{ position: 'absolute', top: 62, left: 0, right: 0, fontSize: 11, color: 'var(--text-hint)', textAlign: 'center' }}>
              {new Date(gStart).toISOString()} → {new Date(gEnd).toISOString()}
            </div>
          </div>
        </div>

        {/* Log Panel: show events for selected sid, database, or unclassified */}
        <div style={{ marginTop: 16, background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: 6, padding: 8 }}>
            {selectedSid === null && selectedDb === null && !selectedUnclassified ? (
              <div style={{ color: 'var(--text-hint)' }}>Click a row to see events</div>
            ) : selectedUnclassified ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Logs - Unclassified</div>
                  <button onClick={() => setSelectedUnclassified(false)} style={{ background: 'var(--button-bg)', color: 'var(--text-muted)', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                </div>
                {(function () {
                  if (unclassifiedEvents.length === 0) {
                    return null;
                  }
                  
                  const minTs = Math.min(...unclassifiedEvents.map((e: any) => e.ts));
                  const maxTs = Math.max(...unclassifiedEvents.map((e: any) => e.ts));
                  const timelineWidth = 380;
                  
                  return (
                    <div style={{ marginBottom: 12, padding: '8px 0' }}>
                      <div style={{ position: 'relative', height: 32, background: 'var(--timeline-event-bg)', borderRadius: 4, padding: '0 10px' }}>
                        {/* Timeline line */}
                        <div style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 2, background: 'rgba(159, 180, 201, 0.3)', transform: 'translateY(-50%)' }} />
                        {/* Event diamonds */}
                        {unclassifiedEvents.map((ev: any, idx: number) => {
                          const pos = maxTs > minTs ? ((ev.ts - minTs) / (maxTs - minTs)) * timelineWidth : timelineWidth / 2;
                          const isSelected = panelFocus === 'events' && focusedEventIndex === idx;
                          return (
                            <div
                              key={idx}
                              title={ev.iso}
                              style={{
                                position: 'absolute',
                                left: 10 + pos,
                                top: '50%',
                                width: isSelected ? 12 : 8,
                                height: isSelected ? 12 : 8,
                                background: isSelected ? '#b380ff' : '#9966ff',
                                transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
                                cursor: 'pointer',
                                border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                                zIndex: isSelected ? 10 : 1,
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => {
                                setFocusedEventIndex(idx);
                                setPanelFocus('events');
                                setTimeout(() => {
                                  const elem = document.querySelectorAll('.event-item')[idx];
                                  if (elem) elem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                                }, 50);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ maxHeight: 480, overflow: 'auto' }}>
                  {unclassifiedEvents.map((ev: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`} 
                      onClick={() => { setFocusedEventIndex(idx); setPanelFocus('events'); }} 
                      style={{ 
                        padding: '6px 8px', 
                        borderBottom: '1px solid rgba(255,255,255,0.02)', 
                        cursor: 'pointer', 
                        background: panelFocus === 'events' && focusedEventIndex === idx ? 'rgba(43, 157, 244, 0.15)' : undefined 
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.iso}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{ev.raw ?? ev.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedDb !== null ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Logs - Database {selectedDb}</div>
                  <button onClick={() => setSelectedDb(null)} style={{ background: 'var(--button-bg)', color: 'var(--text-muted)', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                </div>
                {(function () {
                  const dbStateEvents = dbStates[selectedDb] || [];
                  // Get all database events that mention this specific database
                  const dbSpecificEvents = databaseEvents.filter((e: any) => {
                    const msg = e.message ?? '';
                    const raw = e.raw ?? '';
                    // Match if this database name appears in the event
                    return msg.includes(selectedDb) || raw.includes(selectedDb);
                  });
                  
                  const allDbEvents = [
                    ...dbStateEvents,
                    ...dbSpecificEvents.map(e => {
                      const fullLog = e.raw ?? e.message;
                      // Determine the type/state label
                      const isUpdateDbCmd = /UpdateDatabaseOptionsCommand/.test(fullLog);
                      const state = isUpdateDbCmd ? 'UpdateDatabaseOptionsCommand' : 'Database Event';
                      return {
                        start: e.ts, 
                        iso: e.iso, 
                        state: state, 
                        message: fullLog, 
                        isUpdate: isUpdateDbCmd
                      };
                    })
                  ];
                  allDbEvents.sort((a, b) => a.start - b.start);
                  
                  if (allDbEvents.length === 0) {
                    return null;
                  }
                  
                  const minTs = Math.min(...allDbEvents.map((e: any) => e.start));
                  const maxTs = Math.max(...allDbEvents.map((e: any) => e.start));
                  const timelineWidth = 380;
                  
                  return (
                    <div style={{ marginBottom: 12, padding: '8px 0' }}>
                      <div style={{ position: 'relative', height: 32, background: 'var(--timeline-event-bg)', borderRadius: 4, padding: '0 10px' }}>
                        {/* Timeline line */}
                        <div style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 2, background: 'rgba(159, 180, 201, 0.3)', transform: 'translateY(-50%)' }} />
                        {/* Event diamonds */}
                        {allDbEvents.map((seg: any, idx: number) => {
                          const pos = maxTs > minTs ? ((seg.start - minTs) / (maxTs - minTs)) * timelineWidth : timelineWidth / 2;
                          const isSelected = panelFocus === 'events' && focusedEventIndex === idx;
                          return (
                            <div
                              key={idx}
                              title={seg.iso}
                              style={{
                                position: 'absolute',
                                left: 10 + pos,
                                top: '50%',
                                width: isSelected ? 12 : 8,
                                height: isSelected ? 12 : 8,
                                background: isSelected ? '#43bdff' : '#2b9df4',
                                transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
                                cursor: 'pointer',
                                border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                                zIndex: isSelected ? 10 : 1,
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => {
                                setFocusedEventIndex(idx);
                                setPanelFocus('events');
                                setTimeout(() => {
                                  const elem = document.querySelectorAll('.event-item')[idx];
                                  if (elem) elem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                                }, 50);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ maxHeight: 480, overflow: 'auto' }}>
                  {(function() {
                    const dbStateEvents = dbStates[selectedDb] || [];
                    // Get all database events that mention this specific database
                    const dbSpecificEvents = databaseEvents.filter((e: any) => {
                      const msg = e.message ?? '';
                      const raw = e.raw ?? '';
                      // Match if this database name appears in the event
                      return msg.includes(selectedDb) || raw.includes(selectedDb);
                    });
                    
                    const allDbEvents = [
                      ...dbStateEvents.map((seg: any) => {
                        // Try to find matching event in databaseEvents to get dbDiff
                        const matchingEvent = databaseEvents.find((e: any) => 
                          e.iso === seg.iso && e.message === seg.message
                        );
                        return {
                          ...seg,
                          dbDiff: matchingEvent ? (matchingEvent as any).dbDiff : undefined
                        };
                      }),
                      ...dbSpecificEvents.map(e => {
                        const fullLog = e.raw ?? e.message;
                        // Determine the type/state label
                        const isUpdateDbCmd = /UpdateDatabaseOptionsCommand/.test(fullLog);
                        const state = isUpdateDbCmd ? 'UpdateDatabaseOptionsCommand' : 'Database Event';
                        return {
                          start: e.ts, 
                          iso: e.iso, 
                          state: state, 
                          message: fullLog, 
                          isUpdate: isUpdateDbCmd,
                          dbDiff: (e as any).dbDiff
                        };
                      })
                    ];
                    allDbEvents.sort((a, b) => a.start - b.start);
                    
                    return allDbEvents.map((seg: any, idx) => {
                      const isDbUpdate = /Updated database from DatabaseInfo/.test(seg.message);
                      return (
                        <div key={idx} className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`} onClick={() => { setFocusedEventIndex(idx); setPanelFocus('events'); }} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === idx ? 'rgba(43, 157, 244, 0.15)' : seg.isUpdate ? 'rgba(280, 60%, 60%, 0.05)' : undefined }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{seg.iso}</div>
                          <div style={{ fontSize: 13, color: seg.isUpdate ? '#c9a6ff' : 'var(--text-primary)', fontWeight: 600 }}>{seg.state}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{seg.message}</div>
                          {isDbUpdate && seg.dbDiff && (() => {
                            const changedKeys = Object.keys({...seg.dbDiff.from, ...seg.dbDiff.to}).filter((key: string) => {
                              return seg.dbDiff.from[key] !== seg.dbDiff.to[key];
                            });
                            
                            if (changedKeys.length === 0) {
                              return (
                                <div style={{ marginTop: 6, background: 'rgba(100, 100, 100, 0.15)', padding: '6px 8px', borderRadius: 4, borderLeft: '3px solid rgba(150, 150, 150, 0.4)' }}>
                                  <div style={{ fontSize: 11, color: 'var(--text-hint)', fontStyle: 'italic' }}>No changes detected in database fields</div>
                                </div>
                              );
                            }
                            
                            return (
                              <div style={{ marginTop: 6, background: 'rgba(43, 157, 244, 0.08)', padding: '6px 8px', borderRadius: 4, borderLeft: '3px solid rgba(43, 157, 244, 0.4)' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-hint)', marginBottom: 4 }}>CHANGES:</div>
                                {Object.keys({...seg.dbDiff.from, ...seg.dbDiff.to}).map((key: string) => {
                                  const fromVal = seg.dbDiff.from[key];
                                  const toVal = seg.dbDiff.to[key];
                                  const changed = fromVal !== toVal;
                                  if (!changed) return null;
                                  return (
                                    <div key={key} style={{ marginLeft: 8, fontSize: 11, marginTop: 2 }}>
                                      <span style={{ color: 'var(--text-hint)' }}>{key}=</span>
                                      {fromVal && <span style={{ background: 'rgba(255, 80, 80, 0.2)', color: '#ffb3b3', padding: '1px 3px', borderRadius: 2, textDecoration: 'line-through' }}>{fromVal}</span>}
                                      {fromVal && toVal && <span style={{ color: 'var(--text-hint)', margin: '0 4px' }}>→</span>}
                                      {toVal && <span style={{ background: 'rgba(80, 255, 120, 0.2)', color: '#90ee90', padding: '1px 3px', borderRadius: 2 }}>{toVal}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Logs - sid {selectedSid}</div>
                  <button onClick={() => setSelectedSid(null)} style={{ background: 'var(--button-bg)', color: 'var(--text-muted)', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                </div>
                {(function () {
                  // Build event list first to get timestamps
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
                  related.sort((a, b) => a.ts - b.ts);
                  const frpForSid = failureProtocols.filter(frp => frp.sid === selectedSid);
                  const allEvents = [...related.map(ev => ({ type: 'event', ts: ev.ts, iso: ev.iso, message: ev.message })), ...frpForSid.map(frp => ({ type: 'frp', ts: frp.ts, iso: frp.iso, message: frp.raw }))];
                  allEvents.sort((a, b) => a.ts - b.ts);
                  
                  if (allEvents.length === 0) {
                    return null;
                  }
                  
                  const minTs = Math.min(...allEvents.map(e => e.ts));
                  const maxTs = Math.max(...allEvents.map(e => e.ts));
                  const timelineWidth = 380;
                  
                  return (
                    <div style={{ marginBottom: 12, padding: '8px 0' }}>
                      <div style={{ position: 'relative', height: 32, background: 'var(--timeline-event-bg)', borderRadius: 4, padding: '0 10px' }}>
                        {/* Timeline line */}
                        <div style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 2, background: 'rgba(159, 180, 201, 0.3)', transform: 'translateY(-50%)' }} />
                        {/* Event diamonds */}
                        {allEvents.map((ev, idx) => {
                          const pos = maxTs > minTs ? ((ev.ts - minTs) / (maxTs - minTs)) * timelineWidth : timelineWidth / 2;
                          const isSelected = panelFocus === 'events' && focusedEventIndex === idx;
                          return (
                            <div
                              key={idx}
                              title={ev.iso}
                              style={{
                                position: 'absolute',
                                left: 10 + pos,
                                top: '50%',
                                width: isSelected ? 12 : 8,
                                height: isSelected ? 12 : 8,
                                background: isSelected ? (ev.type === 'frp' ? '#ff7070' : '#43bdff') : (ev.type === 'frp' ? '#ff5050' : '#2b9df4'),
                                transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
                                cursor: 'pointer',
                                border: isSelected ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                                zIndex: isSelected ? 10 : 1,
                                transition: 'all 0.2s ease'
                              }}
                              onClick={() => {
                                setFocusedEventIndex(idx);
                                setPanelFocus('events');
                                setTimeout(() => {
                                  const elem = document.querySelectorAll('.event-item')[idx];
                                  if (elem) elem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                                }, 50);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ maxHeight: 480, overflow: 'auto' }}>
                  {(function () {
                    const instsForSid = rowsBySid[String(selectedSid)] || [];
                    const adminProcs = Array.from(new Set(instsForSid.map(i => i.process)));
                    const intervals = instsForSid.map(i => ({ start: i.start, end: i.end }));
                    const related = events.filter((e: any) => {
                      // Exact match for events with a startId
                      if (e.sid === selectedSid) return true;
                      // Include events without a startId if they fall within the process's lifetime
                      // BUT exclude database events (they belong in the database panel, not process panels)
                      if (e.sid === null && instsForSid.length > 0) {
                        const msg = e.message ?? '';
                        const raw = e.raw ?? '';
                        // Check for database-specific patterns
                        const isDatabaseEvent = 
                          /\bdbName[:=]/.test(msg) || /\bdbName[:=]/.test(raw) ||
                          /Database incarnation change/.test(msg) || /Database incarnation change/.test(raw) ||
                          /Updated database from DatabaseInfo/.test(msg) || /Updated database from DatabaseInfo/.test(raw);
                        if (isDatabaseEvent) return false;
                        return instsForSid.some(inst => e.ts >= inst.start && e.ts <= inst.end);
                      }
                      return false;
                    });
                    related.sort((a, b) => a.ts - b.ts);
                    // Add failure protocol events for this sid
                    const frpForSid = failureProtocols.filter(frp => frp.sid === selectedSid);
                    const allEvents = [...related.map(ev => ({ type: 'event', ts: ev.ts, iso: ev.iso, message: ev.message, raw: ev.raw, fileSource: ev.fileSource, dbDiff: (ev as any).dbDiff })), ...frpForSid.map(frp => ({ type: 'frp', ts: frp.ts, iso: frp.iso, message: frp.raw, raw: frp.raw, fileSource: undefined as string | undefined, dbDiff: undefined }))];
                    allEvents.sort((a, b) => a.ts - b.ts);
                    
                    // Track file changes for separators
                    let lastFileSource: string | undefined = undefined;
                    const elements: JSX.Element[] = [];
                    
                    allEvents.forEach((ev, idx) => {
                      // Add file separator if file source changed
                      if (loadedServer && ev.fileSource && ev.fileSource !== lastFileSource) {
                        elements.push(
                          <div key={`file-sep-${idx}`} style={{ padding: '8px', background: 'rgba(43, 157, 244, 0.08)', borderTop: '2px solid rgba(43, 157, 244, 0.3)', borderBottom: '2px solid rgba(43, 157, 244, 0.3)', margin: '4px 0', fontSize: 12, color: 'var(--text-hint)', fontWeight: 600, textAlign: 'center' }}>
                            📄 {ev.fileSource}
                          </div>
                        );
                        lastFileSource = ev.fileSource;
                      }
                      
                      // Parse the raw log to extract components for highlighting
                      const rawLog = (ev as any).raw || ev.message;
                      const logMatch = rawLog.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+(\S+)\s+(.*)$/);
                      let logLevel = '';
                      let threadInfo = '';
                      let loggerName = '';
                      let logMessage = ev.message;
                      
                      if (logMatch) {
                        // logMatch[1] = timestamp (already displayed separately)
                        logLevel = logMatch[2]; // INFO, WARN, ERROR, etc.
                        threadInfo = logMatch[3]; // thread/process info
                        loggerName = logMatch[4]; // DomainProcessStateMachine, etc.
                        logMessage = logMatch[5]; // the actual message
                      }
                      
                      // Check if this is a RemoveNodeCommand event and extract the reason
                      const isRemoveNode = /RemoveNodeCommand/.test(logMessage);
                      const reasonMatch = isRemoveNode ? logMessage.match(/reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/) : null;
                      const isGraceful = reasonMatch && /Gracefully shutdown engine/i.test(reasonMatch[0]);
                      const hasAssert = reasonMatch && /ASSERT/i.test(reasonMatch[0]);
                      
                      // Check if this is a database update event with diff
                      const isDbUpdate = /Updated database from DatabaseInfo/.test(logMessage);
                      const dbDiff = (ev as any).dbDiff;
                      if (isDbUpdate && logMessage.includes('ENOVIA')) {
                        console.log('Frontend dbDiff for ENOVIA:', dbDiff);
                      }
                      
                      elements.push(
                        <div key={idx} className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`} onClick={() => { setFocusedEventIndex(idx); setPanelFocus('events'); }} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === idx ? 'rgba(43, 157, 244, 0.15)' : ev.type === 'frp' ? 'rgba(255, 80, 80, 0.05)' : undefined }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.iso}</div>
                          <div style={{ fontSize: 13, color: ev.type === 'frp' ? '#ffb3b3' : 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                            {logLevel && (
                              <span style={{ color: logLevel === 'ERROR' ? '#ff6666' : logLevel === 'WARN' ? '#ffdd99' : 'var(--text-hint)', fontWeight: 600, marginRight: 6 }}>{logLevel}</span>
                            )}
                            {threadInfo && (
                              <span style={{ color: 'var(--text-hint)', fontSize: 12, marginRight: 6 }}>[{threadInfo}]</span>
                            )}
                            {loggerName && (
                              <span style={{ color: 'var(--text-hint)', marginRight: 6 }}>{loggerName}</span>
                            )}
                            {isDbUpdate && dbDiff ? (
                              <div>
                                <div style={{ marginBottom: 6 }}>{logMessage}</div>
                                {(() => {
                                  const changedKeys = Object.keys({...dbDiff.from, ...dbDiff.to}).filter(key => {
                                    return dbDiff.from[key] !== dbDiff.to[key];
                                  });
                                  
                                  if (changedKeys.length === 0) {
                                    return (
                                      <div style={{ background: 'rgba(100, 100, 100, 0.15)', padding: '6px 8px', borderRadius: 4, borderLeft: '3px solid rgba(150, 150, 150, 0.4)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-hint)', fontStyle: 'italic' }}>No changes detected in database fields</div>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <div style={{ background: 'rgba(43, 157, 244, 0.08)', padding: '6px 8px', borderRadius: 4, borderLeft: '3px solid rgba(43, 157, 244, 0.4)' }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-hint)', marginBottom: 4 }}>CHANGES:</div>
                                      {Object.keys({...dbDiff.from, ...dbDiff.to}).map(key => {
                                        const fromVal = dbDiff.from[key];
                                        const toVal = dbDiff.to[key];
                                        const changed = fromVal !== toVal;
                                        if (!changed) return null;
                                        return (
                                          <div key={key} style={{ marginLeft: 8, fontSize: 11, marginTop: 2 }}>
                                            <span style={{ color: 'var(--text-hint)' }}>{key}=</span>
                                            {fromVal && <span style={{ background: 'rgba(255, 80, 80, 0.2)', color: '#ffb3b3', padding: '1px 3px', borderRadius: 2, textDecoration: 'line-through' }}>{fromVal}</span>}
                                            {fromVal && toVal && <span style={{ color: 'var(--text-hint)', margin: '0 4px' }}>→</span>}
                                            {toVal && <span style={{ background: 'rgba(80, 255, 120, 0.2)', color: '#90ee90', padding: '1px 3px', borderRadius: 2 }}>{toVal}</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : isRemoveNode && reasonMatch ? (
                              <>
                                {logMessage.substring(0, reasonMatch.index)}
                                <span style={{ background: hasAssert ? 'rgba(255, 0, 0, 0.3)' : isGraceful ? 'rgba(255, 200, 100, 0.2)' : 'rgba(255, 80, 80, 0.2)', color: hasAssert ? '#ff6666' : isGraceful ? '#ffdd99' : '#ffb3b3', padding: '2px 4px', borderRadius: 3, fontWeight: 600, boxShadow: hasAssert ? '0 0 4px rgba(255, 0, 0, 0.4)' : 'none' }}>
                                  {reasonMatch[0]}
                                </span>
                                {logMessage.substring(reasonMatch.index! + reasonMatch[0].length)}
                              </>
                            ) : logMessage}
                          </div>
                        </div>
                      );

                    });
                    
                    return elements;
                  })()}
                </div>
              </div>
            )}
        </div>
      </div>
      )}
    </div>
  );
}

function stateColor(state: string): string {
  const known: Record<string, string> = {
    RUNNING: 'hsl(145 55% 45%)',
    NOT_RUNNING: 'hsl(0 65% 48%)',
    AWAITING_ARCHIVE_HISTORIES_INC: 'hsl(35 85% 55%)',
    AWAITING_ARCHIVE_HISTORIES: 'hsl(35 85% 55%)',
    AWAITING_RESET: 'hsl(20 75% 55%)',
    STARTING: 'hsl(210 70% 55%)',
    STOPPING: 'hsl(355 60% 50%)',
  };
  if (known[state]) return known[state];
  // Fallback: hash state to hue
  let h = 0; for (let i = 0; i < state.length; i++) h = (h * 31 + state.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 60% 48%)`;
}

//@ts-ignore
assert(document);
//@ts-ignore
const root = createRoot(document.getElementById('root')!);
root.render(<StackApp />);
