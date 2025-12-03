type FilterBarProps = {
  filterType: string;
  setFilterType: (type: string) => void;
  filterServers: Set<string>;
  setFilterServers: (servers: Set<string>) => void;
  filterSids: Set<string>;
  setFilterSids: (sids: Set<string>) => void;
  typeOptions: string[];
  allServers: string[];
  allSids: string[];
  serverDropdownOpen: boolean;
  setServerDropdownOpen: (open: boolean) => void;
  sidDropdownOpen: boolean;
  setSidDropdownOpen: (open: boolean) => void;
};

export function FilterBar({
  filterType,
  setFilterType,
  filterServers,
  setFilterServers,
  filterSids,
  setFilterSids,
  typeOptions,
  allServers,
  allSids,
  serverDropdownOpen,
  setServerDropdownOpen,
  sidDropdownOpen,
  setSidDropdownOpen,
}: FilterBarProps): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        borderTop: '1px solid var(--border-primary)',
        borderBottom: '1px solid var(--border-primary)',
        marginTop: 12,
        marginBottom: 12,
        alignItems: 'center',
      }}
    >
      <div
        className="server-dropdown-container"
        style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}
      >
        <label style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 50 }}>
          Server:
        </label>
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
            alignItems: 'center',
          }}
        >
          <span>
            {filterServers.size === 0 ? 'ALL' : `${filterServers.size} selected`}
          </span>
          <span style={{ fontSize: 10 }}>
            {serverDropdownOpen ? '\u25b2' : '\u25bc'}
          </span>
        </button>
        {serverDropdownOpen && (
          <div
            style={{
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
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
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
              ALL
            </label>
            {allServers.map((server) => (
              <label
                key={server}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  borderRadius: 3,
                }}
              >
                <input
                  type="checkbox"
                  checked={filterServers.size === 0 || filterServers.has(server)}
                  onChange={(e: any) => {
                    const newSet = new Set(filterServers);
                    if (e.target.checked) {
                      if (filterServers.size === 0) {
                        // If ALL was selected, now select only this one
                        allServers.forEach((s) => {
                          if (s !== server) newSet.add(s);
                        });
                      } else {
                        newSet.delete(server);
                      }
                    } else {
                      newSet.add(server);
                    }
                    // If all are now selected, clear the set (means ALL)
                    if (newSet.size === allServers.length) {
                      setFilterServers(new Set());
                    } else {
                      setFilterServers(newSet);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
                {server}
              </label>
            ))}
          </div>
        )}
      </div>

      <div
        className="sid-dropdown-container"
        style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}
      >
        <label style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 30 }}>
          SID:
        </label>
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
            alignItems: 'center',
          }}
        >
          <span>
            {filterSids.size === 0 ? 'ALL' : `${filterSids.size} selected`}
          </span>
          <span style={{ fontSize: 10 }}>
            {sidDropdownOpen ? '\u25b2' : '\u25bc'}
          </span>
        </button>
        {sidDropdownOpen && (
          <div
            style={{
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
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
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
              ALL
            </label>
            {allSids.map((sid) => (
              <label
                key={sid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  borderRadius: 3,
                }}
              >
                <input
                  type="checkbox"
                  checked={filterSids.size === 0 || filterSids.has(sid)}
                  onChange={(e: any) => {
                    const newSet = new Set(filterSids);
                    if (e.target.checked) {
                      if (filterSids.size === 0) {
                        allSids.forEach((s) => {
                          if (s !== sid) newSet.add(s);
                        });
                      } else {
                        newSet.delete(sid);
                      }
                    } else {
                      newSet.add(sid);
                    }
                    if (newSet.size === allSids.length) {
                      setFilterSids(new Set());
                    } else {
                      setFilterSids(newSet);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
                {sid}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 40 }}>
          Type:
        </label>
        <select
          value={filterType}
          onChange={(e: any) => setFilterType(e.target.value)}
          style={{
            padding: '4px 8px',
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontSize: 12,
          }}
        >
          <option value="ALL">ALL</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => {
          setFilterSids(new Set());
          setFilterType('ALL');
          setFilterServers(new Set());
        }}
        style={{
          padding: '4px 12px',
          background: 'var(--button-bg)',
          border: '1px solid var(--button-border)',
          borderRadius: 4,
          color: 'var(--text-muted)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Reset filters
      </button>
    </div>
  );
}
