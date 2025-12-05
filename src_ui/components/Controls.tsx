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
  domainStatePanelOpen: boolean;
  setDomainStatePanelOpen: (open: boolean) => void;
  mainViewMode: 'timeline' | 'files';
  setMainViewMode: (mode: 'timeline' | 'files') => void;
  loadMode: LoadMode;
  selectedServer: string;
  onFilesViewClick: () => void;
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
  domainStatePanelOpen,
  setDomainStatePanelOpen,
  mainViewMode,
  setMainViewMode,
  selectedServer,
  onFilesViewClick,
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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          {mainViewMode === 'timeline' && (
            <button
              onClick={() => setDomainStatePanelOpen(!domainStatePanelOpen)}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-secondary)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={`${domainStatePanelOpen ? 'Hide' : 'Show'} Domain State panel`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="10" width="3" height="4" />
                <rect x="6.5" y="6" width="3" height="8" />
                <rect x="11" y="3" width="3" height="11" />
              </svg>
            </button>
          )}

          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 4, padding: 2 }}>
            <button
              onClick={() => setMainViewMode('timeline')}
              style={{
                background: mainViewMode === 'timeline' ? 'var(--button-bg)' : 'transparent',
                color: mainViewMode === 'timeline' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Timeline view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="2,12 5,8 8,10 11,4 14,6" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="2" y1="14" x2="14" y2="14" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              onClick={() => {
                setMainViewMode('files');
                if (loadMode === 'nuosupport' && selectedServer) {
                  onFilesViewClick();
                }
              }}
              disabled={loadMode !== 'nuosupport' || !selectedServer}
              style={{
                background: mainViewMode === 'files' ? 'var(--button-bg)' : 'transparent',
                color: mainViewMode === 'files' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 3,
                cursor: loadMode !== 'nuosupport' || !selectedServer ? 'not-allowed' : 'pointer',
                opacity: loadMode !== 'nuosupport' || !selectedServer ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Files view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2 L6 2 L8 4 L14 4 L14 14 L2 14 Z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{
              background: 'var(--bg-secondary)',
              border: 'none',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="3" />
                <line x1="8" y1="1" x2="8" y2="2.5" strokeLinecap="round"/>
                <line x1="8" y1="13.5" x2="8" y2="15" strokeLinecap="round"/>
                <line x1="15" y1="8" x2="13.5" y2="8" strokeLinecap="round"/>
                <line x1="2.5" y1="8" x2="1" y2="8" strokeLinecap="round"/>
                <line x1="12.5" y1="3.5" x2="11.5" y2="4.5" strokeLinecap="round"/>
                <line x1="4.5" y1="11.5" x2="3.5" y2="12.5" strokeLinecap="round"/>
                <line x1="12.5" y1="12.5" x2="11.5" y2="11.5" strokeLinecap="round"/>
                <line x1="4.5" y1="4.5" x2="3.5" y2="3.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M 14 9 A 6 6 0 1 1 7 2 A 5 5 0 0 0 14 9 Z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
