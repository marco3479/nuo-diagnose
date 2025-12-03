import type { ServerTimeRange, HoveredBar } from '../types';

type ServerTimelineProps = {
  loadMode: 'file' | 'nuosupport';
  selectedPackage: string;
  serverTimeRanges: ServerTimeRange[];
  selectedServer: string;
  setSelectedServer: (server: string) => void;
  apsCollapsed: boolean;
  setApsCollapsed: (collapsed: boolean) => void;
  setHoveredBar: (bar: HoveredBar | null) => void;
  setMousePos: (pos: { x: number; y: number }) => void;
};

export function ServerTimeline({
  loadMode,
  selectedPackage,
  serverTimeRanges,
  selectedServer,
  setSelectedServer,
  apsCollapsed,
  setApsCollapsed,
  setHoveredBar,
  setMousePos,
}: ServerTimelineProps): JSX.Element | null {
  if (loadMode !== 'nuosupport' || !selectedPackage) {
    return null;
  }

  const allStarts = serverTimeRanges.map((r) => r.start);
  const allEnds = serverTimeRanges.map((r) => r.end);
  const minTs = Math.min(...allStarts);
  const maxTs = Math.max(...allEnds);
  const timeSpan = maxTs - minTs || 1;

  return (
    <div
      style={{
        marginBottom: 12,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 6,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom:
            apsCollapsed && selectedServer ? 8 : apsCollapsed ? 0 : 8,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setApsCollapsed(!apsCollapsed)}
      >
        <span
          style={{
            fontSize: 11,
            transform: apsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}
        >
          ▼
        </span>
        Logs from servers
      </div>

      {apsCollapsed && selectedServer && (() => {
        const selectedRange = serverTimeRanges.find(
          (r) => r.server === selectedServer
        );
        if (!selectedRange) return null;

        const left = ((selectedRange.start - minTs) / timeSpan) * 100;
        const width = ((selectedRange.end - selectedRange.start) / timeSpan) * 100;

        return (
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--text-hint)',
                marginBottom: 4,
                paddingLeft: 200,
                paddingRight: 8,
              }}
            >
              <span>
                {new Date(minTs).toISOString().replace('T', ' ').substring(0, 19)}
              </span>
              <span>
                {new Date(maxTs).toISOString().replace('T', ' ').substring(0, 19)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                setMousePos({ x: e.clientX, y: e.clientY });
                setHoveredBar({
                  type: 'process',
                  id: selectedRange.server,
                  content: `${selectedRange.server}\n${selectedRange.startIso} → ${
                    selectedRange.endIso
                  }\nDuration: ${Math.round(
                    (selectedRange.end - selectedRange.start) / 1000 / 60
                  )} minutes`,
                });
              }}
              onMouseLeave={() => setHoveredBar(null)}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
            >
              <div
                style={{
                  width: 190,
                  fontSize: 12,
                  color: 'var(--accent)',
                  fontWeight: 600,
                  textAlign: 'right',
                  paddingRight: 8,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedRange.server}
              </div>
              <div style={{ flex: 1, position: 'relative', height: 20 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${width}%`,
                    height: '100%',
                    background: 'hsl(30, 60%, 45%)',
                    borderRadius: 3,
                    border: '2px solid hsl(30, 65%, 40%)',
                    boxShadow: '0 0 8px rgba(160, 100, 40, 0.4)',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {!apsCollapsed &&
        (serverTimeRanges.length === 0 ? (
          <div style={{ color: 'var(--text-hint)', fontSize: 13, padding: 8 }}>
            Loading APs...
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--text-hint)',
                marginBottom: 4,
                paddingLeft: 200,
                paddingRight: 8,
              }}
            >
              <span>
                {new Date(minTs).toISOString().replace('T', ' ').substring(0, 19)}
              </span>
              <span>
                {new Date(maxTs).toISOString().replace('T', ' ').substring(0, 19)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {serverTimeRanges.map((range) => {
                const left = ((range.start - minTs) / timeSpan) * 100;
                const width = ((range.end - range.start) / timeSpan) * 100;
                const isSelected = selectedServer === range.server;

                return (
                  <div
                    key={range.server}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedServer(range.server)}
                    onMouseEnter={(e) => {
                      setMousePos({ x: e.clientX, y: e.clientY });
                      setHoveredBar({
                        type: 'process',
                        id: range.server,
                        content: `${range.server}\n${range.startIso} → ${
                          range.endIso
                        }\nDuration: ${Math.round(
                          (range.end - range.start) / 1000 / 60
                        )} minutes`,
                      });
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                  >
                    <div
                      style={{
                        width: 190,
                        fontSize: 12,
                        color: isSelected
                          ? 'var(--accent)'
                          : 'var(--text-secondary)',
                        fontWeight: isSelected ? 600 : 400,
                        textAlign: 'right',
                        paddingRight: 8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {range.server}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 20 }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          width: `${width}%`,
                          height: '100%',
                          background: isSelected
                            ? 'hsl(30, 60%, 45%)'
                            : 'hsl(30, 45%, 35%)',
                          borderRadius: 3,
                          border: isSelected
                            ? '2px solid hsl(30, 65%, 40%)'
                            : '1px solid hsl(30, 40%, 30%)',
                          boxShadow: isSelected
                            ? '0 0 8px rgba(160, 100, 40, 0.4)'
                            : 'none',
                          opacity: isSelected ? 1 : 0.6,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
