import React, { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import assert from '../assert';

declare const fetch: any;
declare const document: any;

type Instance = { process: string; sid: number; start: number; end: number; firstIso?: string; lastIso?: string; type?: string; address?: string };
type DbSeg = { state: string; start: number; end: number; iso: string; message: string };
type DbStates = Record<string, DbSeg[]>;
type FailureProtocol = { dbName: string; sid: number; node: number; iteration: number; ts: number; iso: string; message: string; raw: string };

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

function StackApp(): JSX.Element {
  const [path, setPath] = useState('tests/mock/nuoadmin.log');
  const [loadMode, setLoadMode] = useState<'file' | 'nuosupport'>('nuosupport');
  const [zdTickets, setZdTickets] = useState<string[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [diagnosePackages, setDiagnosePackages] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [servers, setServers] = useState<string[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
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
  const [filterAddr, setFilterAddr] = useState<string>('');
  const [filterSid, setFilterSid] = useState<string>('');
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
    const match = urlPath.match(/\/nuosupport\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    
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
          if (match) {
            const [, ticket, pkg, server] = match;
            setLoadMode('nuosupport');
            setSelectedTicket(ticket);
            // Package and server will be set by their respective useEffects
            // Store them temporarily
            (window as any).__initialPackage = pkg;
            (window as any).__initialServer = server;
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
      return;
    }
    // Reset selected server when package changes
    setSelectedServer('');
    setServers([]);
    
    fetch(`/list-servers?ticket=${encodeURIComponent(selectedTicket)}&package=${encodeURIComponent(selectedPackage)}`)
      .then((res: any) => res.json())
      .then((json: any) => {
        if (json.servers) {
          setServers(json.servers);
          // Check if we have a server from URL
          const initialServer = (window as any).__initialServer;
          if (initialServer && json.servers.includes(initialServer)) {
            setSelectedServer(initialServer);
            delete (window as any).__initialServer;
          } else if (json.servers.length > 0) {
            setSelectedServer(json.servers[0]);
          }
        }
      })
      .catch((e: any) => console.error('Failed to load servers:', e));
  }, [selectedTicket, selectedPackage]);

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
  const visible = instances.filter(i => i.end >= gStart && i.start <= gEnd);

  // Group rows by sid (the engine/process id). The `process` field in the instance is the admin process
  // that reported the instance, so grouping by `sid` gives each engine its own row.
  const rowsBySid: Record<string, Instance[]> = {};
  for (const inst of instances) {
    const key = String(inst.sid);
    (rowsBySid[key] ||= []).push(inst);
  }

  // Helper: get type for an instance, falling back to any from same sid
  const instanceType = (i: Instance): string => i.type ?? (rowsBySid[String(i.sid)]?.find(x => x.type)?.type) ?? '';

  // Build filter options (types list)
  const typeOptions = Array.from(new Set(instances.map(instanceType).filter(Boolean))).sort();
  // Apply filters
  const filtered = visible.filter(i => {
    const t = instanceType(i);
    if (filterType !== 'ALL' && t !== filterType) return false;
    if (filterAddr.trim() && !(String(i.address ?? '').toLowerCase().includes(filterAddr.trim().toLowerCase()))) return false;
    if (filterSid.trim() && !(String(i.sid).includes(filterSid.trim()))) return false;
    return true;
  });

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
              } else if (row && row.type === 'instance' && 'instance' in row && row.instance) {
                setSelectedSid(row.instance.sid);
                setSelectedDb(null);
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
                setFocusedTimelineItem({type: 'db', key: row.key, index: 0});
              } else if (row && row.type === 'instance' && 'instance' in row && row.instance) {
                setSelectedSid(row.instance.sid);
                setSelectedDb(null);
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
          eventCount = (dbStates[selectedDb] || []).length;
        } else if (selectedSid !== null) {
          const sidRe = new RegExp(`\\b(?:startIds?|start-id|sid)[:=]\\s*${selectedSid}\\b(?!\\d)`, 'i');
          const instsForSid = rowsBySid[String(selectedSid)] || [];
          const related = events.filter((e: any) => {
            const raw = e.raw ?? '';
            const msg = e.message ?? '';
            return sidRe.test(raw) || sidRe.test(msg);
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
  }, [focusedRowIndex, focusedEventIndex, focusedTimelineItem, panelFocus, allTableRows, selectedSid, selectedDb, selectedUnclassified, dbStates, events, failureProtocols, rowsBySid, addresses, groupsByAddress, hasUnclassified]);

  return (
    <div className="app">
      <div className="controls">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
          <label>
            Load from:
            <select value={loadMode} onChange={(e: any) => setLoadMode(e.target.value)} style={{ marginLeft: 6 }}>
              <option value="nuosupport">nuosupport</option>
              <option value="file">file path</option>
            </select>
          </label>
        </div>
        
        {loadMode === 'file' ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label>Log path: <input value={path} onChange={(e: any) => setPath(e.target.value)} style={{ width: 360 }} /></label>
            <button onClick={() => load()} disabled={loading}>Load</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label>
                ZD Ticket:
                <select value={selectedTicket} onChange={(e: any) => setSelectedTicket(e.target.value)} style={{ marginLeft: 6, minWidth: 120 }}>
                  <option value="">Select ticket...</option>
                  {zdTickets.slice().reverse().map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {zdTickets.length > 0 && (
                  <span style={{ fontSize: 11, color: '#7da3b8', marginLeft: 6 }}>
                    ({zdTickets.length} tickets loaded)
                  </span>
                )}
              </label>
              {zdTickets.length === 0 && (
                <span style={{ fontSize: 11, color: '#ff8888' }}>
                  Loading tickets... (Check console for errors)
                </span>
              )}
              <label>
                Diagnose Package:
                <select value={selectedPackage} onChange={(e: any) => setSelectedPackage(e.target.value)} style={{ marginLeft: 6, minWidth: 200 }} disabled={!selectedTicket}>
                  <option value="">Select package...</option>
                  {diagnosePackages.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>
                Server:
                <select 
                  value={selectedServer} 
                  onChange={(e: any) => setSelectedServer(e.target.value)} 
                  onKeyDown={(e: any) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      const select = e.target;
                      const currentIndex = select.selectedIndex;
                      let newIndex = currentIndex;
                      
                      if (e.key === 'ArrowDown' && currentIndex < select.options.length - 1) {
                        newIndex = currentIndex + 1;
                      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
                        newIndex = currentIndex - 1;
                      }
                      
                      if (newIndex !== currentIndex && newIndex > 0) {
                        const newValue = select.options[newIndex].value;
                        if (newValue) {
                          setSelectedServer(newValue);
                        }
                      }
                    }
                  }}
                  style={{ marginLeft: 6, minWidth: 250 }} 
                  disabled={!selectedPackage}
                >
                  <option value="">Select server...</option>
                  {servers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {loading && <span style={{ color: '#7da3b8', fontSize: 13 }}>Loading...</span>}
            </div>
            {loadedServer && (
              <div style={{ fontSize: 13, color: '#7da3b8', fontStyle: 'italic' }}>
                Loaded all nuoadmin.log* files from: {loadedServer}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="timeline">
        {/* Database state row(s) */}
        {Object.keys(dbStates || {}).length > 0 ? (
          <div className="stack-area" style={{ position: 'relative' }} onMouseMove={(e: any) => { const rect = e.currentTarget.getBoundingClientRect(); setCursorX(e.clientX - rect.left); }} onMouseLeave={() => setCursorX(null)}>
            {cursorX !== null && <div style={{ position: 'absolute', left: cursorX, top: 0, bottom: 0, width: 1, background: 'rgba(255, 255, 255, 0.3)', pointerEvents: 'none', zIndex: 100 }} />}
            {Object.entries(dbStates).map(([db, segs]) => {
              return (
                <div key={`db-${db}`} className="stack-row" style={{ opacity: 0.95, cursor: 'pointer', outline: focusedTimelineItem?.type === 'db' && focusedTimelineItem?.key === db ? '2px solid rgba(43, 157, 244, 0.6)' : 'none', outlineOffset: -2 }} onClick={() => { setFocusedTimelineItem({type: 'db', key: db, index: 0}); setPanelFocus('timeline'); setSelectedDb(db); setSelectedSid(null); }}>
                  <div className="stack-label">DB {db}</div>
                  <div className="stack-track">
                    <div className="selection-overlay" style={{ left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`, right: `${100 - ((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%` }} />
                    {segs.map((seg, idx) => {
                      const left = ((seg.start - globalStart) / (globalEnd - globalStart)) * 100;
                      const right = ((seg.end - globalStart) / (globalEnd - globalStart)) * 100;
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
                      );
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
                        const left = ((ev.ts - globalStart) / (globalEnd - globalStart)) * 100;
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
                        );
                      });
                    })()}
                  </div>
                </div>
              );
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
                <div className="selection-overlay" style={{ left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`, right: `${100 - ((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%` }} />
                {unclassifiedEvents.map((ev: any, idx: number) => {
                  const left = ((ev.ts - globalStart) / (globalEnd - globalStart)) * 100;
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
                  const first = procInst[0];
                  // prefer any available type for this sid (some occurrences may have type missing)
                  const anyType = procInst.find(x => x.type && x.type.length > 0)?.type ?? undefined;
                  const label = first ? `sid ${sid}${anyType ? ' — ' + anyType : ''}` : `sid ${sid}`;

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

                  return (
                    <div key={`sidrow-${sid}`} className="stack-row layer" style={{ cursor: 'pointer', outline: focusedTimelineItem?.type === 'sid' && focusedTimelineItem?.key === sid ? '2px solid rgba(43, 157, 244, 0.6)' : 'none', outlineOffset: -2 }} onClick={() => { setFocusedTimelineItem({type: 'sid', key: sid, index: 0}); setPanelFocus('timeline'); setSelectedSid(Number(sid)); setSelectedDb(null); }}>
                      <div className="stack-label">{label}</div>
                      <div className="stack-track">
                        <div className="selection-overlay" style={{ left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`, right: `${100 - ((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%` }} />
                        {procInst.map((inst, idx) => {
                          // Check for all RemoveNodeCommand events for this sid
                          const removeEvents = events.filter((e: any) => {
                            const msg = e.message ?? '';
                            const sidMatch = new RegExp(`\\bstartId=${sid}\\b`, 'i').test(msg);
                            return sidMatch && /RemoveNodeCommand/.test(msg);
                          });
                          const hasNonGracefulRemoval = removeEvents.some(e => !/Gracefully shutdown engine/i.test(e.message ?? ''));
                          
                          // If no RemoveNodeCommand found, extend bar to globalEnd (process still running)
                          const effectiveEnd = removeEvents.length > 0 ? inst.end : globalEnd;
                          
                          const left = ((inst.start - globalStart) / (globalEnd - globalStart)) * 100;
                          const right = ((effectiveEnd - globalStart) / (globalEnd - globalStart)) * 100;
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
                          const left = ((frp.ts - globalStart) / (globalEnd - globalStart)) * 100;
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
                            const left = ((ev.ts - globalStart) / (globalEnd - globalStart)) * 100;
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
                  );
                })}
              </div>
            );
          })};
        </div>

        {/* Popover for timeline bars */}
        {hoveredBar && (
          <div 
            style={{
              position: 'absolute',
              positionAnchor: `--${hoveredBar.id}` as any,
              top: 'anchor(bottom)',
              left: 'anchor(center)',
              translate: '-50% 8px',
              background: 'rgba(15, 30, 45, 0.98)',
              border: '1px solid rgba(43, 157, 244, 0.4)',
              borderRadius: 6,
              padding: '8px 12px',
              color: '#e6eef6',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              zIndex: 1000,
              maxWidth: 600,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              pointerEvents: 'none'
            } as any}
          >
            {hoveredBar.content}
          </div>
        )}

        {/* Double-handle range slider */}
        <div style={{ display: 'flex', marginTop: 8, marginBottom: 12 }}>
          <div style={{ width: 'var(--label-width)', flexShrink: 0 }} />
          <div className="range-slider-track" style={{ flex: 1, position: 'relative', height: 40 }}>
            <div style={{ position: 'absolute', top: 12, left: 0, right: 0, height: 4, background: '#1b2b3a', borderRadius: 2 }}>
              <div 
                style={{ position: 'absolute', left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`, right: `${100 - ((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%`, height: rangeBarHover ? '8px' : '100%', top: rangeBarHover ? '-2px' : 0, background: 'rgba(46, 204, 113, 0.4)', borderRadius: 2, cursor: 'grab', transition: 'height 0.15s ease, top 0.15s ease' }}
                onMouseEnter={() => setRangeBarHover(true)}
                onMouseLeave={() => setRangeBarHover(false)}
                onMouseDown={(e: any) => { e.preventDefault(); setDragging('range'); setDragStartX(e.clientX); setDragStartRange({start: gStart, end: gEnd}); }}
              />
            </div>
            <div
              style={{ position: 'absolute', left: `${((gStart - globalStart) / (globalEnd - globalStart)) * 100}%`, top: 8, width: 12, height: 12, background: '#fff', border: '2px solid var(--accent)', borderRadius: '50%', cursor: 'ew-resize', zIndex: 2 }}
              onMouseDown={(e) => { e.preventDefault(); setDragging('start'); }}
            />
            <div
              style={{ position: 'absolute', left: `${((gEnd - globalStart) / (globalEnd - globalStart)) * 100}%`, top: 8, width: 12, height: 12, background: '#fff', border: '2px solid var(--accent)', borderRadius: '50%', cursor: 'ew-resize', zIndex: 2 }}
              onMouseDown={(e) => { e.preventDefault(); setDragging('end'); }}
            />
            <div style={{ position: 'absolute', top: 24, left: 0, right: 0, fontSize: 11, color: '#7da3b8', textAlign: 'center' }}>
              {new Date(gStart).toISOString()} → {new Date(gEnd).toISOString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <table className="table" style={{ flex: 1 }}>
            <thead>
              <tr>
                <th onClick={() => toggleSort('sid')} style={{ cursor: 'pointer' }}>sid{sortKey === 'sid' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('type')} style={{ cursor: 'pointer' }}>Type{sortKey === 'type' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('address')} style={{ cursor: 'pointer' }}>Address{sortKey === 'address' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('start')} style={{ cursor: 'pointer' }}>Start{sortKey === 'start' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('end')} style={{ cursor: 'pointer' }}>End{sortKey === 'end' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              </tr>
              <tr>
                <th>
                  <input value={filterSid} onChange={(e: any) => setFilterSid(e.target.value)} placeholder="sid" style={{ width: 70 }} />
                </th>
                <th>
                  <select value={filterType} onChange={(e: any) => setFilterType(e.target.value)}>
                    <option value="ALL">All</option>
                    {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </th>
                <th>
                  <input list="addrOptions" value={filterAddr} onChange={(e: any) => setFilterAddr(e.target.value)} placeholder="search address" style={{ minWidth: 200 }} />
                  <datalist id="addrOptions">
                    {Array.from(new Set(instances.map(i => i.address).filter(Boolean) as string[])).sort().map(a => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </th>
                <th colSpan={2}>
                  <button onClick={() => { setFilterSid(''); setFilterType('ALL'); setFilterAddr(''); }} style={{ background: '#0b2b34', color: '#9fb4c9', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>Reset filters</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Unclassified events row */}
              {unclassifiedEvents.length > 0 && (
                <tr 
                  key="unclassified" 
                  onClick={() => { 
                    setSelectedUnclassified(true);
                    setSelectedSid(null);
                    setSelectedDb(null);
                    setPanelFocus('table');
                    setFocusedEventIndex(0);
                    setFocusedTimelineItem({type: 'unclassified', key: 'unclassified', index: 0});
                  }} 
                  style={{ cursor: 'pointer', background: selectedUnclassified ? 'rgba(43, 157, 244, 0.1)' : undefined }}
                >
                  <td style={{ color: '#9fb4c9' }}>—</td>
                  <td style={{ color: '#9fb4c9' }}>Unclassified</td>
                  <td colSpan={3} style={{ fontSize: 12, color: '#7da3b8' }}>{unclassifiedEvents.length} events not associated with any process or database</td>
                </tr>
              )}
              {Object.keys(dbStates || {}).map((db, dbIdx) => (
                <tr key={`db-${db}`} onClick={() => { setSelectedDb(db); setSelectedSid(null); setSelectedUnclassified(false); setFocusedRowIndex(dbIdx); setPanelFocus('table'); setFocusedEventIndex(0); setFocusedTimelineItem({type: 'db', key: db, index: 0}); }} style={{ cursor: 'pointer', background: selectedDb === db ? 'rgba(43, 157, 244, 0.1)' : undefined }}>
                  <td style={{ color: '#9fb4c9' }}>—</td>
                  <td style={{ color: '#9fb4c9' }}>Database</td>
                  <td>{db}</td>
                  <td colSpan={2} style={{ fontSize: 12, color: '#7da3b8' }}>Click to view state transitions</td>
                </tr>
              ))}
              {visibleSorted.map((i, idx) => {
                const rowIndex = Object.keys(dbStates || {}).length + idx;
                
                // Detect issues for this process
                const hasFailureProtocol = failureProtocols.some(frp => frp.sid === i.sid);
                const removeEvents = events.filter((e: any) => {
                  const msg = e.message ?? '';
                  const sidMatch = new RegExp(`\\bstartId=${i.sid}\\b`, 'i').test(msg);
                  return sidMatch && /RemoveNodeCommand/.test(msg);
                });
                const hasNonGracefulRemoval = removeEvents.some(e => !/Gracefully shutdown engine/i.test(e.message ?? ''));
                const hasAssert = removeEvents.some(e => {
                  const reasonMatch = e.message?.match(/reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/);
                  return reasonMatch && /ASSERT/i.test(reasonMatch[0]);
                });
                
                // Determine issue severity
                const hasIssue = hasFailureProtocol || hasNonGracefulRemoval || hasAssert;
                const isCritical = hasAssert || hasFailureProtocol;
                
                const rowStyle: any = {
                  cursor: 'pointer',
                  background: selectedSid === i.sid ? 'rgba(43, 157, 244, 0.1)' : undefined,
                  borderLeft: hasIssue ? (isCritical ? '3px solid #ff0000' : '3px solid #ff8844') : undefined,
                  boxShadow: hasIssue ? (isCritical ? '0 0 8px rgba(255, 0, 0, 0.3)' : '0 0 6px rgba(255, 136, 68, 0.2)') : undefined
                };
                
                return (
                <tr key={`row-${idx}`} onClick={() => { setSelectedSid(i.sid); setSelectedDb(null); setSelectedUnclassified(false); setFocusedRowIndex(rowIndex); setPanelFocus('table'); setFocusedEventIndex(0); setFocusedTimelineItem({type: 'sid', key: String(i.sid), index: 0}); }} style={rowStyle}>
                  <td style={{ color: '#bfe7ff' }}>
                    {i.sid}
                    {hasAssert && <span style={{ marginLeft: 6, color: '#ff6666', fontSize: 11, fontWeight: 600 }} title="ASSERT detected">⚠</span>}
                    {hasFailureProtocol && <span style={{ marginLeft: 6, color: '#ff4444', fontSize: 11, fontWeight: 600 }} title="Failure Protocol">⚠</span>}
                  </td>
                  <td>{instanceType(i)}</td>
                  <td>{i.address ?? ''}</td>
                  <td>{i.firstIso ?? new Date(i.start).toISOString()}</td>
                  <td>{i.lastIso ?? new Date(i.end).toISOString()}</td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {/* Side panel: show events for selected sid */}
          <div style={{ width: 420, background: '#05131a', border: '1px solid #12303a', borderRadius: 6, padding: 8 }}>
            {selectedSid === null && selectedDb === null && !selectedUnclassified ? (
              <div style={{ color: '#7da3b8' }}>Click a row to see events</div>
            ) : selectedUnclassified ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Unclassified Events</div>
                  <button onClick={() => setSelectedUnclassified(false)} style={{ background: '#0b2b34', color: '#9fb4c9', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>Close</button>
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
                      <div style={{ position: 'relative', height: 32, background: '#0a1e28', borderRadius: 4, padding: '0 10px' }}>
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
                      <div style={{ fontSize: 12, color: '#9fb4c9' }}>{ev.iso}</div>
                      <div style={{ fontSize: 13, color: '#e6eef6', whiteSpace: 'pre-wrap' }}>{(ev.raw ?? ev.message).replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4}\s+/, '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedDb !== null ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Database state transitions: {selectedDb}</div>
                  <button onClick={() => setSelectedDb(null)} style={{ background: '#0b2b34', color: '#9fb4c9', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>Close</button>
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
                      const messageWithoutIso = fullLog.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4}\s+/, '');
                      // Determine the type/state label
                      const isUpdateDbCmd = /UpdateDatabaseOptionsCommand/.test(fullLog);
                      const state = isUpdateDbCmd ? 'UpdateDatabaseOptionsCommand' : 'Database Event';
                      return {
                        start: e.ts, 
                        iso: e.iso, 
                        state: state, 
                        message: messageWithoutIso, 
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
                      <div style={{ position: 'relative', height: 32, background: '#0a1e28', borderRadius: 4, padding: '0 10px' }}>
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
                      ...dbStateEvents,
                      ...dbSpecificEvents.map(e => {
                        const fullLog = e.raw ?? e.message;
                        const messageWithoutIso = fullLog.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4}\s+/, '');
                        // Determine the type/state label
                        const isUpdateDbCmd = /UpdateDatabaseOptionsCommand/.test(fullLog);
                        const state = isUpdateDbCmd ? 'UpdateDatabaseOptionsCommand' : 'Database Event';
                        return {
                          start: e.ts, 
                          iso: e.iso, 
                          state: state, 
                          message: messageWithoutIso, 
                          isUpdate: isUpdateDbCmd
                        };
                      })
                    ];
                    allDbEvents.sort((a, b) => a.start - b.start);
                    
                    return allDbEvents.map((seg: any, idx) => (
                      <div key={idx} className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`} onClick={() => { setFocusedEventIndex(idx); setPanelFocus('events'); }} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === idx ? 'rgba(43, 157, 244, 0.15)' : seg.isUpdate ? 'rgba(280, 60%, 60%, 0.05)' : undefined }}>
                        <div style={{ fontSize: 12, color: '#9fb4c9' }}>{seg.iso}</div>
                        <div style={{ fontSize: 13, color: seg.isUpdate ? '#c9a6ff' : '#e6eef6', fontWeight: 600 }}>{seg.state}</div>
                        <div style={{ fontSize: 12, color: '#cfe6f7', whiteSpace: 'pre-wrap', marginTop: 2 }}>{seg.message}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Events for sid {selectedSid}</div>
                  <button onClick={() => setSelectedSid(null)} style={{ background: '#0b2b34', color: '#9fb4c9', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                </div>
                {(function () {
                  // Build event list first to get timestamps
                  const sidRe = new RegExp(`\\b(?:startIds?|start-id|sid)[:=]\\s*${selectedSid}\\b(?!\\d)`, 'i');
                  const instsForSid = rowsBySid[String(selectedSid)] || [];
                  const related = events.filter((e: any) => {
                    const raw = e.raw ?? '';
                    const msg = e.message ?? '';
                    return sidRe.test(raw) || sidRe.test(msg);
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
                      <div style={{ position: 'relative', height: 32, background: '#0a1e28', borderRadius: 4, padding: '0 10px' }}>
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
                    // Match only exact sid values - not as part of larger numbers or in arrays
                    const sidRe = new RegExp(`\\b(?:startIds?|start-id|sid)[:=]\\s*${selectedSid}\\b(?!\\d)`, 'i');
                    const instsForSid = rowsBySid[String(selectedSid)] || [];
                    const adminProcs = Array.from(new Set(instsForSid.map(i => i.process)));
                    const intervals = instsForSid.map(i => ({ start: i.start, end: i.end }));
                    const related = events.filter((e: any) => {
                      const raw = e.raw ?? '';
                      const msg = e.message ?? '';
                      // ONLY match explicit mention of this exact sid
                      return sidRe.test(raw) || sidRe.test(msg);
                    });
                    related.sort((a, b) => a.ts - b.ts);
                    // Add failure protocol events for this sid
                    const frpForSid = failureProtocols.filter(frp => frp.sid === selectedSid);
                    const allEvents = [...related.map(ev => ({ type: 'event', ts: ev.ts, iso: ev.iso, message: ev.message, fileSource: ev.fileSource })), ...frpForSid.map(frp => ({ type: 'frp', ts: frp.ts, iso: frp.iso, message: frp.raw.replace(/^\S+\s+/, ''), fileSource: undefined as string | undefined }))];
                    allEvents.sort((a, b) => a.ts - b.ts);
                    
                    // Track file changes for separators
                    let lastFileSource: string | undefined = undefined;
                    const elements: JSX.Element[] = [];
                    
                    allEvents.forEach((ev, idx) => {
                      // Add file separator if file source changed
                      if (loadedServer && ev.fileSource && ev.fileSource !== lastFileSource) {
                        elements.push(
                          <div key={`file-sep-${idx}`} style={{ padding: '8px', background: 'rgba(43, 157, 244, 0.08)', borderTop: '2px solid rgba(43, 157, 244, 0.3)', borderBottom: '2px solid rgba(43, 157, 244, 0.3)', margin: '4px 0', fontSize: 12, color: '#7da3b8', fontWeight: 600, textAlign: 'center' }}>
                            📄 {ev.fileSource}
                          </div>
                        );
                        lastFileSource = ev.fileSource;
                      }
                      
                      // Check if this is a RemoveNodeCommand event and extract the reason
                      const isRemoveNode = /RemoveNodeCommand/.test(ev.message);
                      const reasonMatch = isRemoveNode ? ev.message.match(/reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/) : null;
                      const isGraceful = reasonMatch && /Gracefully shutdown engine/i.test(reasonMatch[0]);
                      const hasAssert = reasonMatch && /ASSERT/i.test(reasonMatch[0]);
                      
                      elements.push(
                        <div key={idx} className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`} onClick={() => { setFocusedEventIndex(idx); setPanelFocus('events'); }} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === idx ? 'rgba(43, 157, 244, 0.15)' : ev.type === 'frp' ? 'rgba(255, 80, 80, 0.05)' : undefined }}>
                          <div style={{ fontSize: 12, color: '#9fb4c9' }}>{ev.iso}</div>
                          <div style={{ fontSize: 13, color: ev.type === 'frp' ? '#ffb3b3' : '#e6eef6', whiteSpace: 'pre-wrap' }}>
                            {isRemoveNode && reasonMatch ? (
                              <>
                                {ev.message.substring(0, reasonMatch.index)}
                                <span style={{ background: hasAssert ? 'rgba(255, 0, 0, 0.3)' : isGraceful ? 'rgba(255, 200, 100, 0.2)' : 'rgba(255, 80, 80, 0.2)', color: hasAssert ? '#ff6666' : isGraceful ? '#ffdd99' : '#ffb3b3', padding: '2px 4px', borderRadius: 3, fontWeight: 600, boxShadow: hasAssert ? '0 0 4px rgba(255, 0, 0, 0.4)' : 'none' }}>
                                  {reasonMatch[0]}
                                </span>
                                {ev.message.substring(reasonMatch.index! + reasonMatch[0].length)}
                              </>
                            ) : ev.message}
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
      </div>
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
