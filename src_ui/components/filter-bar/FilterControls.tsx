import type { JSX } from 'react';
import { NONE_SELECTED, type FilterControlsComponentProps } from './types';

export function FilterControls({
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
  compact = false,
}: FilterControlsComponentProps): JSX.Element {
  const allServersSelected = filterServers.size === 0;
  const noServersSelected = filterServers.has(NONE_SELECTED);
  const allSidsSelected = filterSids.size === 0;
  const noSidsSelected = filterSids.has(NONE_SELECTED);

  const labelStyle = compact
    ? { fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }
    : { fontSize: 12, color: 'var(--text-muted)', minWidth: 50 };

  const dropdownButtonStyle = compact
    ? {
        width: '100%',
        minWidth: 0,
        padding: '3px 6px',
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderRadius: 4,
        color: 'var(--text-primary)',
        fontSize: 11,
        cursor: 'pointer',
        textAlign: 'left' as const,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 4,
      }
    : {
        padding: '4px 8px',
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderRadius: 4,
        color: 'var(--text-primary)',
        fontSize: 12,
        cursor: 'pointer',
        minWidth: 120,
        textAlign: 'left' as const,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      };

  const compactSummary = (selected: number, allSelected: boolean, noneSelected: boolean): string => {
    if (allSelected) return 'All';
    if (noneSelected) return '0';
    return `${selected}`;
  };

  const serverSummary = compact
    ? compactSummary(filterServers.size, allServersSelected, noServersSelected)
    : allServersSelected
      ? 'ALL'
      : noServersSelected
        ? 'NONE'
        : `${filterServers.size} selected`;

  const sidSummary = compact
    ? compactSummary(filterSids.size, allSidsSelected, noSidsSelected)
    : allSidsSelected
      ? 'ALL'
      : noSidsSelected
        ? 'NONE'
        : `${filterSids.size} selected`;

  const controlContainerStyle = compact
    ? {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 4,
        width: '100%',
        alignContent: 'center',
      }
    : {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        minWidth: 0,
      };

  const fieldWrapperStyle = compact
    ? { position: 'relative' as const, display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0 }
    : { position: 'relative' as const, display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 };

  const serverLabelWidth = compact ? 0 : 50;
  const sidLabelWidth = compact ? 0 : 30;

  return (
    <div style={controlContainerStyle}>
      <div className="server-dropdown-container" style={fieldWrapperStyle}>
        <label style={labelStyle}>{compact ? 'Server' : 'Server:'}</label>
        <button onClick={() => setServerDropdownOpen(!serverDropdownOpen)} style={dropdownButtonStyle}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{serverSummary}</span>
          <span style={{ fontSize: 10, flexShrink: 0 }}>{serverDropdownOpen ? '\u25b2' : '\u25bc'}</span>
        </button>
        {serverDropdownOpen && (
          <div style={{ position: 'absolute', top: '100%', left: serverLabelWidth, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: 8, zIndex: 1000, maxHeight: 300, overflowY: 'auto', minWidth: compact ? 140 : 200, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={allServersSelected}
                onChange={(event) => {
                  if (event.target.checked) {
                    setFilterServers(new Set());
                  } else {
                    setFilterServers(new Set([NONE_SELECTED]));
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              ALL
            </label>
            {allServers.map((server) => (
              <label key={server} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3 }}>
                <input
                  type="checkbox"
                  checked={allServersSelected || filterServers.has(server)}
                  onChange={(event) => {
                    let newSet: Set<string>;
                    if (allServersSelected) {
                      newSet = new Set(allServers);
                    } else if (noServersSelected) {
                      newSet = new Set();
                    } else {
                      newSet = new Set(filterServers);
                    }

                    newSet.delete(NONE_SELECTED);

                    if (event.target.checked) {
                      newSet.add(server);
                    } else {
                      newSet.delete(server);
                    }

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

      <div className="sid-dropdown-container" style={fieldWrapperStyle}>
        <label style={compact ? { fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 } : { fontSize: 12, color: 'var(--text-muted)', minWidth: 30 }}>
          {compact ? 'SID' : 'SID:'}
        </label>
        <button onClick={() => setSidDropdownOpen(!sidDropdownOpen)} style={compact ? { ...dropdownButtonStyle, minWidth: 0 } : { ...dropdownButtonStyle, minWidth: 100 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sidSummary}</span>
          <span style={{ fontSize: 10, flexShrink: 0 }}>{sidDropdownOpen ? '\u25b2' : '\u25bc'}</span>
        </button>
        {sidDropdownOpen && (
          <div style={{ position: 'absolute', top: '100%', left: sidLabelWidth, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: 8, zIndex: 1000, maxHeight: 300, overflowY: 'auto', minWidth: compact ? 120 : 150, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={allSidsSelected}
                onChange={(event) => {
                  if (event.target.checked) {
                    setFilterSids(new Set());
                  } else {
                    setFilterSids(new Set([NONE_SELECTED]));
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              ALL
            </label>
            {allSids.map((sid) => (
              <label key={sid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 3 }}>
                <input
                  type="checkbox"
                  checked={allSidsSelected || filterSids.has(sid)}
                  onChange={(event) => {
                    let newSet: Set<string>;
                    if (allSidsSelected) {
                      newSet = new Set(allSids);
                    } else if (noSidsSelected) {
                      newSet = new Set();
                    } else {
                      newSet = new Set(filterSids);
                    }

                    newSet.delete(NONE_SELECTED);

                    if (event.target.checked) {
                      newSet.add(sid);
                    } else {
                      newSet.delete(sid);
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

      <div style={compact ? { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } : { display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={compact ? { fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 } : { fontSize: 12, color: 'var(--text-muted)', minWidth: 40 }}>
          {compact ? 'Type' : 'Type:'}
        </label>
        <select value={filterType} onChange={(event) => setFilterType(event.target.value)} style={{ width: compact ? '100%' : undefined, minWidth: compact ? 0 : undefined, padding: compact ? '3px 6px' : '4px 8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: compact ? 11 : 12 }}>
          <option value="ALL">ALL</option>
          {typeOptions.map((typeOption) => (
            <option key={typeOption} value={typeOption}>
              {typeOption}
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
        title="Reset filters"
        style={{ width: compact ? '100%' : undefined, padding: compact ? '3px 6px' : '4px 12px', background: 'var(--button-bg)', border: '1px solid var(--button-border)', borderRadius: 4, color: 'var(--text-muted)', fontSize: compact ? 11 : 12, cursor: 'pointer', alignSelf: compact ? 'end' : undefined }}
      >
        {compact ? 'Reset' : 'Reset filters'}
      </button>
    </div>
  );
}
