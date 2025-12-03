import type {
  Instance,
  EventType,
  FailureProtocol,
  FocusedTimelineItem,
  HoveredBar,
} from '../types';
import { getInstanceType } from '../utils';

type ProcessTimelineProps = {
  addresses: string[];
  groupsByAddress: Record<string, string[]>;
  rowsBySid: Record<string, Instance[]>;
  allRowsBySid: Record<string, Instance[]>;
  events: EventType[];
  failureProtocols: FailureProtocol[];
  gStart: number;
  gEnd: number;
  globalEnd: number;
  cursorX: number | null;
  setCursorX: (x: number | null) => void;
  focusedTimelineItem: FocusedTimelineItem | null;
  setFocusedTimelineItem: (item: FocusedTimelineItem | null) => void;
  setPanelFocus: (focus: 'timeline' | 'table' | 'events') => void;
  setSelectedSid: (sid: number | null) => void;
  setSelectedDb: (db: string | null) => void;
  setSelectedUnclassified: (selected: boolean) => void;
  setHoveredBar: (bar: HoveredBar | null) => void;
};

export function ProcessTimeline({
  addresses,
  groupsByAddress,
  rowsBySid,
  allRowsBySid,
  events,
  failureProtocols,
  gStart,
  gEnd,
  globalEnd,
  cursorX,
  setCursorX,
  focusedTimelineItem,
  setFocusedTimelineItem,
  setPanelFocus,
  setSelectedSid,
  setSelectedDb,
  setSelectedUnclassified,
  setHoveredBar,
}: ProcessTimelineProps) {
  return (
    <div
      className="stack-area"
      style={{ position: 'relative' }}
      onMouseMove={(e: any) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setCursorX(e.clientX - rect.left);
      }}
      onMouseLeave={() => setCursorX(null)}
    >
      {cursorX !== null && (
        <div
          style={{
            position: 'absolute',
            left: cursorX,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(255, 255, 255, 0.3)',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        />
      )}
      {addresses.map((addr) => {
        const sids = groupsByAddress[addr] || [];
        return (
          <div key={`group-${addr}`}>
            <div className="stack-row" style={{ opacity: 0.9, fontWeight: 600 }}>
              <div className="stack-label" style={{ color: 'white', fontSize: 10 }}>
                {addr}
              </div>
              <div className="stack-track" />
            </div>
            {sids.map((sid, sidIndexInGroup) => {
              const procInst = (rowsBySid[sid] || []).sort((a, b) => a.start - b.start);
              if (procInst.length === 0) return null;

              const anyType =
                procInst.find((x) => x.type && x.type.length > 0)?.type ?? undefined;
              const label = `${anyType ? anyType + ' - ' : ''}${sid}`;

              let baseHue = 200;
              let baseSat = 50;
              let baseLit = 48;
              if (anyType === 'SM') {
                baseHue = 210;
                baseSat = 70;
              } else if (anyType === 'TE') {
                baseHue = 35;
                baseSat = 78;
              }
              const hueVariation =
                anyType === 'TE'
                  ? ((sidIndexInGroup * 3) % 40) - 7
                  : anyType === 'SM'
                  ? ((sidIndexInGroup * 15) % 60) - 30
                  : 0;
              if (!anyType || (anyType !== 'TE' && anyType !== 'SM')) {
                baseHue = 270;
                baseSat = 60;
                baseLit = 50;
              }
              const hue = baseHue + hueVariation;

              const hasFailureProtocol = failureProtocols.some(
                (frp) => frp.sid === Number(sid)
              );
              const removeEvents = events.filter((e: any) => {
                return e.sid === Number(sid) && /RemoveNodeCommand/.test(e.message ?? '');
              });
              const hasNonGracefulRemoval = removeEvents.some(
                (e) => !/Gracefully shutdown engine/i.test(e.message ?? '')
              );
              const hasAssert = removeEvents.some((e) => {
                const reasonMatch = e.message?.match(
                  /reason=([^,]+(?:,\s*[^=]+?(?=,\s*\w+=|$))*)/
                );
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
                    outline:
                      focusedTimelineItem?.type === 'sid' && focusedTimelineItem?.key === sid
                        ? '2px solid rgba(43, 157, 244, 0.6)'
                        : 'none',
                    outlineOffset: -2,
                    borderLeft: hasIssue
                      ? isCritical
                        ? '3px solid #ff0000'
                        : '3px solid #ff8844'
                      : undefined,
                    boxShadow: hasIssue
                      ? isCritical
                        ? '0 0 8px rgba(255, 0, 0, 0.3)'
                        : '0 0 6px rgba(255, 136, 68, 0.2)'
                      : undefined,
                  }}
                  onClick={() => {
                    setFocusedTimelineItem({ type: 'sid', key: sid, index: 0 });
                    setPanelFocus('timeline');
                    setSelectedSid(Number(sid));
                    setSelectedDb(null);
                    setSelectedUnclassified(false);
                  }}
                >
                  <div className="stack-label">
                    {label}
                    {hasAssert && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: '#ff6666',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                        title="ASSERT detected"
                      >
                        ⚠
                      </span>
                    )}
                    {hasFailureProtocol && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: '#ff4444',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                        title="Failure Protocol"
                      >
                        ⚠
                      </span>
                    )}
                  </div>
                  <div className="stack-track">
                    {procInst.map((inst, idx) => {
                      const removeEvents = events.filter(
                        (e: any) =>
                          e.sid === inst.sid && /RemoveNodeCommand/.test(e.message ?? '')
                      );
                      const hasNonGracefulRemoval = removeEvents.some(
                        (e) => !/Gracefully shutdown engine/i.test(e.message ?? '')
                      );

                      const effectiveEnd = removeEvents.length > 0 ? inst.end : globalEnd;
                      const instanceOverlaps = effectiveEnd >= gStart && inst.start <= gEnd;
                      if (!instanceOverlaps) return null;

                      const left = Math.max(
                        0,
                        ((inst.start - gStart) / (gEnd - gStart)) * 100
                      );
                      const right = Math.min(
                        100,
                        ((effectiveEnd - gStart) / (gEnd - gStart)) * 100
                      );
                      const width = Math.max(0.2, right - left);
                      const lit = baseLit + ((idx * 8) % 20) - 10;
                      const style: any = {
                        left: `${left}%`,
                        width: `${width}%`,
                        background: `hsl(${hue}deg ${baseSat}% ${lit}%)`,
                      };

                      let tooltipContent = `sid=${inst.sid} ${inst.firstIso ?? ''} → ${
                        removeEvents.length > 0 ? inst.lastIso ?? '' : 'still running'
                      }`;
                      if (removeEvents.length > 0) {
                        tooltipContent += '\n\nRemoveNodeCommand events:\n';
                        removeEvents.forEach((re) => {
                          tooltipContent += `${re.iso}: ${re.message}\n`;
                        });
                      } else {
                        tooltipContent +=
                          '\n\nNo RemoveNodeCommand found - process still running or log incomplete';
                      }

                      const barId = `bar-${sid}-${idx}`;

                      return (
                        <div
                          key={`inst-${sid}-${idx}`}
                          className="instance-bar process-bar"
                          style={style}
                          onMouseEnter={() =>
                            setHoveredBar({ type: 'process', id: barId, content: tooltipContent })
                          }
                          onMouseLeave={() => setHoveredBar(null)}
                        />
                      );
                    })}
                    {failureProtocols
                      .filter((frp) => frp.sid === Number(sid))
                      .map((frp, idx) => {
                        const left = ((frp.ts - gStart) / (gEnd - gStart)) * 100;
                        const tooltipContent = frp.raw.replace(/^(\S+)\s+/, '$1\n');
                        const frpId = `frp-${sid}-${idx}`;
                        return (
                          <div
                            key={frpId}
                            className="frp-dot"
                            style={
                              {
                                left: `${left}%`,
                                position: 'absolute',
                                top: '2px',
                                width: 8,
                                height: 8,
                                background: 'hsla(0, 80%, 50%, 0.9)',
                                transform: 'rotate(45deg)',
                                zIndex: 10,
                                anchorName: `--${frpId}`,
                              } as any
                            }
                            onMouseEnter={() =>
                              setHoveredBar({ type: 'frp', id: frpId, content: tooltipContent })
                            }
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
      })}
    </div>
  );
}
