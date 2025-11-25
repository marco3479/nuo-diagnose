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
  const [instances, setInstances] = useState<Instance[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [dbStates, setDbStates] = useState<DbStates>({});
  const [failureProtocols, setFailureProtocols] = useState<FailureProtocol[]>([]);
  const [selectedSid, setSelectedSid] = useState<number | null>(null);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [globalStart, setGlobalStart] = useState<number>(Date.now());
  const [globalEnd, setGlobalEnd] = useState<number>(Date.now() + 1);
  const [loading, setLoading] = useState(false);
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
  const [focusedTimelineItem, setFocusedTimelineItem] = useState<{type: 'db' | 'sid', key: string, index: number} | null>(null);
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

  useEffect(() => { load(); }, []);

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

  // Build all rows (db rows + instance rows) for keyboard navigation
  const allTableRows = [...Object.keys(dbStates || {}).map(db => ({ type: 'db' as const, key: db })), ...visibleSorted.map((inst, idx) => ({ type: 'instance' as const, key: `inst-${idx}`, instance: inst }))];

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
        // Build timeline items list (db rows + sid rows)
        const timelineItems: Array<{type: 'db' | 'sid', key: string}> = [
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
              if (nextItem.type === 'db') {
                setSelectedDb(nextItem.key);
                setSelectedSid(null);
              } else {
                setSelectedSid(Number(nextItem.key));
                setSelectedDb(null);
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
              if (prevItem.type === 'db') {
                setSelectedDb(prevItem.key);
                setSelectedSid(null);
              } else {
                setSelectedSid(Number(prevItem.key));
                setSelectedDb(null);
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
        } else if (e.key === 'ArrowRight' && (selectedSid !== null || selectedDb !== null)) {
          e.preventDefault();
          setPanelFocus('events');
          setFocusedEventIndex(0);
        }
      } else if (panelFocus === 'events') {
        // Get current event list
        let eventCount = 0;
        if (selectedDb !== null) {
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
  }, [focusedRowIndex, focusedEventIndex, focusedTimelineItem, panelFocus, allTableRows, selectedSid, selectedDb, dbStates, events, failureProtocols, rowsBySid, addresses, groupsByAddress]);

  return (
    <div className="app">
      <div className="controls">
        <label>Log path: <input value={path} onChange={(e: any) => setPath(e.target.value)} style={{ width: 360 }} /></label>
        <button onClick={() => load()} disabled={loading}>Load</button>
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
                          const tooltipContent = `${frp.iso}\n${frp.raw}`;
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
              {Object.keys(dbStates || {}).map((db, dbIdx) => (
                <tr key={`db-${db}`} onClick={() => { setSelectedDb(db); setSelectedSid(null); setFocusedRowIndex(dbIdx); setPanelFocus('table'); setFocusedEventIndex(0); setFocusedTimelineItem({type: 'db', key: db, index: 0}); }} style={{ cursor: 'pointer', background: selectedDb === db ? 'rgba(43, 157, 244, 0.1)' : undefined }}>
                  <td style={{ color: '#9fb4c9' }}>—</td>
                  <td style={{ color: '#9fb4c9' }}>Database</td>
                  <td>{db}</td>
                  <td colSpan={2} style={{ fontSize: 12, color: '#7da3b8' }}>Click to view state transitions</td>
                </tr>
              ))}
              {visibleSorted.map((i, idx) => {
                const rowIndex = Object.keys(dbStates || {}).length + idx;
                return (
                <tr key={`row-${idx}`} onClick={() => { setSelectedSid(i.sid); setSelectedDb(null); setFocusedRowIndex(rowIndex); setPanelFocus('table'); setFocusedEventIndex(0); setFocusedTimelineItem({type: 'sid', key: String(i.sid), index: 0}); }} style={{ cursor: 'pointer', background: selectedSid === i.sid ? 'rgba(43, 157, 244, 0.1)' : undefined }}>
                  <td style={{ color: '#bfe7ff' }}>{i.sid}</td>
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
            {selectedSid === null && selectedDb === null ? (
              <div style={{ color: '#7da3b8' }}>Click a row to see events</div>
            ) : selectedDb !== null ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Database state transitions: {selectedDb}</div>
                  <button onClick={() => setSelectedDb(null)} style={{ background: '#0b2b34', color: '#9fb4c9', border: 'none', padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                </div>
                {(function () {
                  const dbEvents = dbStates[selectedDb] || [];
                  if (dbEvents.length === 0) {
                    return null;
                  }
                  
                  const minTs = Math.min(...dbEvents.map(e => e.start));
                  const maxTs = Math.max(...dbEvents.map(e => e.start));
                  const timelineWidth = 380;
                  
                  return (
                    <div style={{ marginBottom: 12, padding: '8px 0' }}>
                      <div style={{ position: 'relative', height: 32, background: '#0a1e28', borderRadius: 4, padding: '0 10px' }}>
                        {/* Timeline line */}
                        <div style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 2, background: 'rgba(159, 180, 201, 0.3)', transform: 'translateY(-50%)' }} />
                        {/* Event diamonds */}
                        {dbEvents.map((seg, idx) => {
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
                  {(dbStates[selectedDb] || []).map((seg, idx) => (
                    <div key={idx} className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`} onClick={() => { setFocusedEventIndex(idx); setPanelFocus('events'); }} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === idx ? 'rgba(43, 157, 244, 0.15)' : undefined }}>
                      <div style={{ fontSize: 12, color: '#9fb4c9' }}>{seg.iso}</div>
                      <div style={{ fontSize: 13, color: '#e6eef6', fontWeight: 600 }}>{seg.state}</div>
                      <div style={{ fontSize: 12, color: '#cfe6f7', whiteSpace: 'pre-wrap', marginTop: 2 }}>{seg.message}</div>
                    </div>
                  ))}
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
                    const allEvents = [...related.map(ev => ({ type: 'event', ts: ev.ts, iso: ev.iso, message: ev.message })), ...frpForSid.map(frp => ({ type: 'frp', ts: frp.ts, iso: frp.iso, message: frp.raw.replace(/^\S+\s+/, '') }))];
                    allEvents.sort((a, b) => a.ts - b.ts);
                    return allEvents.map((ev, idx) => {
                      // Check if this is a RemoveNodeCommand event and extract the reason
                      const isRemoveNode = /RemoveNodeCommand/.test(ev.message);
                      const reasonMatch = isRemoveNode ? ev.message.match(/reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/) : null;
                      const isGraceful = reasonMatch && /Gracefully shutdown engine/i.test(reasonMatch[0]);
                      
                      return (
                      <div key={idx} className={`event-item${panelFocus === 'events' && focusedEventIndex === idx ? ' focused' : ''}`} onClick={() => { setFocusedEventIndex(idx); setPanelFocus('events'); }} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: panelFocus === 'events' && focusedEventIndex === idx ? 'rgba(43, 157, 244, 0.15)' : ev.type === 'frp' ? 'rgba(255, 80, 80, 0.05)' : undefined }}>
                        <div style={{ fontSize: 12, color: '#9fb4c9' }}>{ev.iso}</div>
                        <div style={{ fontSize: 13, color: ev.type === 'frp' ? '#ffb3b3' : '#e6eef6', whiteSpace: 'pre-wrap' }}>
                          {isRemoveNode && reasonMatch ? (
                            <>
                              {ev.message.substring(0, reasonMatch.index)}
                              <span style={{ background: isGraceful ? 'rgba(255, 200, 100, 0.2)' : 'rgba(255, 80, 80, 0.2)', color: isGraceful ? '#ffdd99' : '#ffb3b3', padding: '2px 4px', borderRadius: 3, fontWeight: 600 }}>
                                {reasonMatch[0]}
                              </span>
                              {ev.message.substring(reasonMatch.index! + reasonMatch[0].length)}
                            </>
                          ) : ev.message}
                        </div>
                      </div>
                      );
                    });
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
