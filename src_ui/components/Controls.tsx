import type { LoadMode } from '../types';

declare const window: any;

type ControlsProps = {
  loadMode: LoadMode;
  setLoadMode: (mode: LoadMode) => void;
  path: string;
  setPath: (path: string) => void;
  loading: boolean;
  onLoad: () => void;
  selectedTicket: string;
  setSelectedTicket: (ticket: string) => void;
  zdTickets: string[];
  selectedPackage: string;
  setSelectedPackage: (pkg: string) => void;
  diagnosePackages: string[];
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
};

export function Controls({
  loadMode,
  setLoadMode,
  path,
  setPath,
  loading,
  onLoad,
  selectedTicket,
  setSelectedTicket,
  zdTickets,
  selectedPackage,
  setSelectedPackage,
  diagnosePackages,
  theme,
  setTheme,
}: ControlsProps): JSX.Element {
  return (
    <div className="controls">
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 8,
          width: '100%',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Load from:
          <select
            value={loadMode}
            onChange={(e: any) => setLoadMode(e.target.value)}
          >
            <option value="nuosupport">nuosupport</option>
            <option value="file">file path</option>
          </select>
        </label>

        {loadMode === 'file' ? (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Log path:
              <input
                type="text"
                value={path}
                onChange={(e: any) => setPath(e.target.value)}
                style={{ width: 360 }}
              />
            </label>
            <button onClick={onLoad} disabled={loading}>
              Load
            </button>
          </>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              ZD Ticket:
              <select
                value={selectedTicket}
                onChange={(e: any) => setSelectedTicket(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="">Select ticket...</option>
                {zdTickets
                  .slice()
                  .reverse()
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Diagnose Package:
              <select
                value={selectedPackage}
                onChange={(e: any) => setSelectedPackage(e.target.value)}
                style={{ minWidth: 200 }}
                disabled={!selectedTicket}
              >
                <option value="">Select package...</option>
                {diagnosePackages.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {loading && (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Loading...
              </span>
            )}
          </>
        )}

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{
            marginLeft: 'auto',
            justifySelf: 'flex-end',
            fontSize: 16,
          }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? '◐' : '◑'}
        </button>
      </div>
    </div>
  );
}
