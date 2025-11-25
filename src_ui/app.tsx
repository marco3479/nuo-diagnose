import React, { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import assert from '../assert';

declare const fetch: any;

type Instance = { process: string; sid: number; start: number; end: number; firstIso?: string; lastIso?: string; type?: string; address?: string };
type DbSeg = { state: string; start: number; end: number; iso: string; message: string };
type DbStates = Record<string, DbSeg[]>;

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}

function StackApp(): JSX.Element{
  const [path, setPath] = useState('tests/mock/nuoadmin.log');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [dbStates, setDbStates] = useState<DbStates>({});
  const [selectedSid, setSelectedSid] = useState<number | null>(null);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [globalStart, setGlobalStart] = useState<number>(Date.now());
  const [globalEnd, setGlobalEnd] = useState<number>(Date.now()+1);
  const [loading,setLoading] = useState(false);
  // Table filters & sorting
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterAddr, setFilterAddr] = useState<string>('');
  const [filterSid, setFilterSid] = useState<string>('');
  const [sortKey, setSortKey] = useState<'sid'|'type'|'address'|'start'|'end'>('sid');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  async function load(p=path){
    setLoading(true);
    try{
      const res = await fetch(`/events.json?path=${encodeURIComponent(p)}`);
      const json = await res.json();
      const insts:Instance[] = (json.instances||[]).map((i:any)=>({process:i.process,sid:i.sid,start:i.start,end:i.end,firstIso:i.firstIso,lastIso:i.lastIso,type:i.type,address:i.address}));
      setInstances(insts.sort((a,b)=>a.start-b.start));
      setEvents(json.events || []);
      setDbStates(json.dbStates || {});
      if(json.range && json.range.start && json.range.end){
        setGlobalStart(json.range.start); setGlobalEnd(json.range.end);
        setRangeStart(json.range.start); setRangeEnd(json.range.end);
      } else if(insts.length){
        const firstInst = insts[0]!;
        const lastInst = (insts[insts.length-1] ?? insts[0])!;
        setGlobalStart(firstInst.start); setGlobalEnd((lastInst.end ?? lastInst.start));
        setRangeStart(firstInst.start); setRangeEnd((lastInst.end ?? lastInst.start));
      }
    }catch(e){
      console.error(e);
    }finally{setLoading(false)}
  }

  useEffect(()=>{ load(); }, []);

  const span = Math.max(1, (rangeEnd ?? globalEnd) - (rangeStart ?? globalStart));
  const gStart = rangeStart ?? globalStart;
  const gEnd = rangeEnd ?? globalEnd;

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
  const instanceType = (i: Instance): string => i.type ?? (rowsBySid[String(i.sid)]?.find(x=>x.type)?.type) ?? '';

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

  const toggleSort = (key: 'sid'|'type'|'address'|'start'|'end') => {
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

  return (
    <div className="app">
      <div className="controls">
        <label>Log path: <input value={path} onChange={(e:any)=>setPath(e.target.value)} style={{width:360}}/></label>
        <button onClick={()=>load()} disabled={loading}>Load</button>
        <div style={{marginLeft:'auto'}} className="hint">Drag range sliders to adjust selection window</div>
      </div>

      <div className="timeline">
        {/* Database state row(s) */}
        {Object.keys(dbStates||{}).length > 0 ? (
          <div className="stack-area" style={{marginBottom:6}}>
            {Object.entries(dbStates).map(([db, segs])=>{
              return (
                <div key={`db-${db}`} className="stack-row" style={{opacity:0.95}}>
                  <div className="stack-label">DB {db}</div>
                  <div className="stack-track">
                    <div className="selection-overlay" style={{left:`${((gStart-globalStart)/(globalEnd-globalStart))*100}%`, right:`${100-((gEnd-globalStart)/(globalEnd-globalStart))*100}%`}} />
                    {segs.map((seg, idx)=>{
                      const left = ((seg.start - globalStart) / (globalEnd - globalStart)) * 100;
                      const right = ((seg.end - globalStart) / (globalEnd - globalStart)) * 100;
                      const width = Math.max(0.2, right - left);
                      const bg = stateColor(seg.state);
                      const title = `${seg.state} — ${seg.iso}\n${seg.message}`;
                      return <div key={`dbseg-${db}-${idx}`} className="instance-bar db-bar" style={{left:`${left}%`, width:`${width}%`, background:bg}} title={title} />
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stack-area" style={{marginBottom:6}}>
            <div className="stack-row" style={{height:20}}>
              <div className="stack-label">Database</div>
              <div className="stack-track">
                <div className="hint" style={{position:'absolute',left:0}}>
                  No database state transitions found in this log.
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="stack-area">
          {addresses.map((addr) => {
            const sids = groupsByAddress[addr] || [];
            return (
              <div key={`group-${addr}`}>
                <div className="stack-row" style={{opacity:0.9, fontWeight:600}}>
                  <div className="stack-label" style={{ color:"white"}}>{addr}</div>
                  <div className="stack-track" />
                </div>
                {sids.map((sid) => {
                  const procInst = (rowsBySid[sid] || []).sort((a,b)=>a.start-b.start);
                  const first = procInst[0];
                  // prefer any available type for this sid (some occurrences may have type missing)
                  const anyType = procInst.find(x => x.type && x.type.length > 0)?.type ?? undefined;
                  const label = first ? `sid ${sid}${anyType ? ' — '+anyType : ''}` : `sid ${sid}`;
                  return (
                    <div key={`sidrow-${sid}`} className="stack-row">
                      <div className="stack-label">{label}</div>
                      <div className="stack-track">
                        <div className="selection-overlay" style={{left:`${((gStart-globalStart)/(globalEnd-globalStart))*100}%`, right:`${100-((gEnd-globalStart)/(globalEnd-globalStart))*100}%`}} />
                        {procInst.map((inst,idx)=>{
                          const left = ((inst.start - globalStart) / (globalEnd - globalStart)) * 100;
                          const right = ((inst.end - globalStart) / (globalEnd - globalStart)) * 100;
                          const width = Math.max(0.2, right - left);
                          const hue = (Number(sid) * 41) % 360;
                          const style:any = { left:`${left}%`, width:`${width}%`, background:`hsl(${hue}deg 60% 48%)` };
                          return <div key={`${sid}-${inst.sid}-${idx}`} className="instance-bar" title={`sid=${inst.sid} ${inst.firstIso??''} → ${inst.lastIso??''}`} style={style} />;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{marginTop:12,display:'flex',alignItems:'center',gap:12}} className="range-controls">
          <label className="hint">Start:</label>
          <input type="range" min={globalStart} max={globalEnd} value={gStart} onChange={(e:any)=>{const v=Number(e.target.value); const endVal = Math.max(v, rangeEnd ?? globalEnd); setRangeStart(v); setRangeEnd(endVal);}} />
          <label className="hint">End:</label>
          <input type="range" min={globalStart} max={globalEnd} value={gEnd} onChange={(e:any)=>{const v=Number(e.target.value); const startVal = Math.min(v, rangeStart ?? globalStart); setRangeEnd(v); setRangeStart(startVal);}} />
          <div style={{marginLeft:12}} className="hint">Range: {new Date(gStart).toISOString()} → {new Date(gEnd).toISOString()}</div>
        </div>

        <div style={{display:'flex',gap:12}}>
        <table className="table" style={{flex:1}}>
          <thead>
            <tr>
              <th onClick={()=>toggleSort('sid')} style={{cursor:'pointer'}}>sid{sortKey==='sid' ? (sortDir==='asc'?' ▲':' ▼') : ''}</th>
              <th onClick={()=>toggleSort('type')} style={{cursor:'pointer'}}>Type{sortKey==='type' ? (sortDir==='asc'?' ▲':' ▼') : ''}</th>
              <th onClick={()=>toggleSort('address')} style={{cursor:'pointer'}}>Address{sortKey==='address' ? (sortDir==='asc'?' ▲':' ▼') : ''}</th>
              <th onClick={()=>toggleSort('start')} style={{cursor:'pointer'}}>Start{sortKey==='start' ? (sortDir==='asc'?' ▲':' ▼') : ''}</th>
              <th onClick={()=>toggleSort('end')} style={{cursor:'pointer'}}>End{sortKey==='end' ? (sortDir==='asc'?' ▲':' ▼') : ''}</th>
            </tr>
            <tr>
              <th>
                <input value={filterSid} onChange={(e:any)=>setFilterSid(e.target.value)} placeholder="sid" style={{width:70}} />
              </th>
              <th>
                <select value={filterType} onChange={(e:any)=>setFilterType(e.target.value)}>
                  <option value="ALL">All</option>
                  {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </th>
              <th>
                <input list="addrOptions" value={filterAddr} onChange={(e:any)=>setFilterAddr(e.target.value)} placeholder="search address" style={{minWidth:200}} />
                <datalist id="addrOptions">
                  {Array.from(new Set(instances.map(i=>i.address).filter(Boolean) as string[])).sort().map(a => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </th>
              <th colSpan={2}>
                <button onClick={()=>{setFilterSid(''); setFilterType('ALL'); setFilterAddr('');}} style={{background:'#0b2b34',color:'#9fb4c9',border:'none',padding:'6px 8px',borderRadius:4,cursor:'pointer'}}>Reset filters</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleSorted.map((i,idx)=>(
              <tr key={`row-${idx}`} onClick={()=>setSelectedSid(i.sid)} style={{cursor:'pointer'}}>
                <td style={{color:'#bfe7ff'}}>{i.sid}</td>
                <td>{instanceType(i)}</td>
                <td>{i.address ?? ''}</td>
                <td>{i.firstIso ?? new Date(i.start).toISOString()}</td>
                <td>{i.lastIso ?? new Date(i.end).toISOString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Side panel: show events for selected sid */}
        <div style={{width:420,background:'#05131a',border:'1px solid #12303a',borderRadius:6,padding:8}}>
          {selectedSid === null ? (
            <div style={{color:'#7da3b8'}}>Click a row to see events for that sid</div>
          ) : (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontWeight:600}}>Events for sid {selectedSid}</div>
                <button onClick={()=>setSelectedSid(null)} style={{background:'#0b2b34',color:'#9fb4c9',border:'none',padding:'6px 8px',borderRadius:4,cursor:'pointer'}}>Close</button>
              </div>
              <div style={{maxHeight:480,overflow:'auto'}}>
                {(function(){
                  const sidRe = new RegExp(`\\b(?:startIds|startId|start-id|sid)[:=\\[]?\\s*${selectedSid}\\b`, 'i');
                  const instsForSid = rowsBySid[String(selectedSid)] || [];
                  const adminProcs = Array.from(new Set(instsForSid.map(i => i.process)));
                  const intervals = instsForSid.map(i => ({ start: i.start, end: i.end }));
                  const related = events.filter((e: any) => {
                    const raw = e.raw ?? '';
                    const msg = e.message ?? '';
                    // match explicit mention of the sid (startId, startIds, sid)
                    if (sidRe.test(raw) || sidRe.test(msg)) return true;
                    // otherwise, only accept events from the admin process(es) that reported this sid
                    // if they include specific tokens that tie them to lifecycle actions for this instance
                    if (adminProcs.includes(e.process)) {
                      const adminTokenRe = /\b(connectKey|hostAndPort|address|startIds?|start-id|startId|Applied StartNodes?|Applying StartNodes?|Applied StartNodeCommand|Applying StartNodeCommand|RemoveNodeCommand|ShutdownNodesCommand|Applied RemoveNodeCommand|Applied ShutdownNodesCommand)\b/i;
                      if (adminTokenRe.test(raw) || adminTokenRe.test(msg)) {
                        // additionally, ensure the event timestamp lies within the instance window
                        for (const iv of intervals) {
                          if (e.ts >= iv.start && e.ts <= iv.end) return true;
                        }
                      }
                    }
                    return false;
                  });
                  related.sort((a,b)=>a.ts - b.ts);
                  return related.map((ev,idx)=>(
                    <div key={idx} style={{padding:'6px 8px',borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                      <div style={{fontSize:12,color:'#9fb4c9'}}>{ev.iso}</div>
                      <div style={{fontSize:13,color:'#e6eef6',whiteSpace:'pre-wrap'}}>{ev.message}</div>
                    </div>
                  ));
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
  const known: Record<string,string> = {
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
  let h = 0; for (let i=0;i<state.length;i++) h = (h*31 + state.charCodeAt(i))>>>0;
  const hue = h % 360;
  return `hsl(${hue} 60% 48%)`;
}

//@ts-ignore
assert(document);
//@ts-ignore
const root = createRoot(document.getElementById('root')!);
root.render(<StackApp />);
