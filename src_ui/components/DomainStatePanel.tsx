import React from 'react';
import type { DomainState, DomainStateSnapshot } from '../types';

type DomainStatePanelProps = {
  currentSnapshot: DomainStateSnapshot | null;
  previousSnapshot: DomainStateSnapshot | null;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
};

export function DomainStatePanel({ currentSnapshot, previousSnapshot, isOpen, onClose, onNext, onPrev, hasNext, hasPrev }: DomainStatePanelProps) {
  const domainState = currentSnapshot?.state || null;
  // Find the leader server
  const leader = domainState?.servers.find(s => s.role === 'LEADER');
  const followers = domainState?.servers.filter(s => s.role === 'FOLLOWER') || [];
  const otherServers = domainState?.servers.filter(s => s.role !== 'LEADER' && s.role !== 'FOLLOWER') || [];
  const nonLeaderServers = [...followers, ...otherServers];
  
  // Get ghost servers (servers that were in previous state but not in current)
  const ghostServers = React.useMemo(() => {
    if (!previousSnapshot || !currentSnapshot) return [];
    const currentServerIds = new Set(currentSnapshot.state.servers.map(s => s.serverId));
    return previousSnapshot.state.servers.filter(s => !currentServerIds.has(s.serverId) && s.role !== 'LEADER');
  }, [previousSnapshot, currentSnapshot]);
  
  // Include ghost servers in the circle layout, maintaining their original order from previous state
  // This keeps positions stable when servers are removed
  const allNonLeaderServers = React.useMemo(() => {
    if (!previousSnapshot) {
      return nonLeaderServers;
    }
    
    // Get the order from previous state (all non-leader servers)
    const prevOrder = previousSnapshot.state.servers
      .filter(s => s.role !== 'LEADER')
      .map(s => s.serverId);
    
    // Create a map for quick lookup
    const serverMap = new Map<string, typeof nonLeaderServers[0]>();
    nonLeaderServers.forEach(s => serverMap.set(s.serverId, s));
    ghostServers.forEach(s => serverMap.set(s.serverId, s));
    
    // Rebuild array: first in previous order, then append new servers
    const result = prevOrder
      .filter(id => serverMap.has(id))
      .map(id => serverMap.get(id)!);
    
    // Add any new servers that weren't in previous state
    const prevOrderSet = new Set(prevOrder);
    nonLeaderServers.forEach(s => {
      if (!prevOrderSet.has(s.serverId)) {
        result.push(s);
      }
    });
    
    return result;
  }, [nonLeaderServers, ghostServers, previousSnapshot]);
  
  // Get all databases and their processes grouped by server
  const getProcessesForServer = (serverId: string) => {
    if (!domainState) return [];
    const processes: Array<{type: string; dbName: string; status: string; nodeId: number; isNew?: boolean; isRemoved?: boolean}> = [];
    domainState.databases.forEach(db => {
      db.processes.forEach(proc => {
        if (proc.serverId === serverId) {
          processes.push({
            type: proc.type,
            dbName: db.name,
            status: proc.status,
            nodeId: proc.nodeId,
            isNew: changeInfo.newProcessIds.has(proc.nodeId),
            isRemoved: changeInfo.removedProcessIds.has(proc.nodeId),
          });
        }
      });
    });
    return processes;
  };
  
  // Also get processes from previous state that were removed (for ghost display)
  const getGhostProcessesForServer = (serverId: string) => {
    if (!previousSnapshot || !currentSnapshot) return [];
    const ghostProcesses: Array<{type: string; dbName: string; nodeId: number}> = [];
    
    // Get current process IDs for this server
    const currentProcessIds = new Set<number>();
    currentSnapshot.state.databases.forEach(db => {
      db.processes.forEach(proc => {
        if (proc.serverId === serverId) {
          currentProcessIds.add(proc.nodeId);
        }
      });
    });
    
    // Find processes from previous state that are no longer in current state
    previousSnapshot.state.databases.forEach(db => {
      db.processes.forEach(proc => {
        if (proc.serverId === serverId && !currentProcessIds.has(proc.nodeId)) {
          ghostProcesses.push({
            type: proc.type,
            dbName: db.name,
            nodeId: proc.nodeId,
          });
        }
      });
    });
    
    return ghostProcesses;
  };
  
  // Fixed circle dimensions - scale based on number of servers
  const serverCount = allNonLeaderServers.length;
  // Calculate size based on server count: more servers = bigger circle
  // When there's a leader, we need significantly more space
  const baseSize = leader ? 400 : 300;
  const sizeIncrement = leader ? 50 : 40;
  const maxSize = leader ? 800 : 600;
  const circleSize = Math.min(maxSize, Math.max(baseSize, baseSize + serverCount * sizeIncrement));
  const centerX = circleSize / 2;
  const centerY = circleSize / 2;
  // Radius is proportional to circle size, leaving space for server nodes
  // When there's a leader, use much larger radius to avoid overlap with center
  const marginForNode = 80; // Space for server node width
  const radius = leader ? (circleSize / 2) - marginForNode - 20 : (circleSize / 2) - marginForNode;
  
  // Calculate positions for servers in a circle
  const getServerPosition = (index: number, total: number) => {
    const angle = (index * 2 * Math.PI) / total - Math.PI / 2; // Start from top
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  // Calculate quorum - based on connected servers
  // For even: n/2 + 1, for odd: (n+1)/2 = ceil(n/2)
  // Special case: 1 server cannot have quorum (needs at least 2)
  const totalServers = domainState?.servers.length || 0;
  const connectedServers = domainState?.servers.filter(s => s.status.includes('Connected')).length || 0;
  const quorumNeeded = totalServers === 1 ? 2 : Math.floor(totalServers / 2) + 1;
  const hasQuorum = connectedServers >= quorumNeeded;

  // Compute changes from previous state
  const changeInfo = React.useMemo(() => {
    if (!currentSnapshot || !previousSnapshot) {
      return {
        logs: [],
        newServerIds: new Set<string>(),
        removedServerIds: new Set<string>(),
        changedServerIds: new Set<string>(),
        newProcessIds: new Set<number>(),
        removedProcessIds: new Set<number>(),
        changedProcessIds: new Set<number>(),
      };
    }
    
    const logs: string[] = [];
    const prevState = previousSnapshot.state;
    const currState = currentSnapshot.state;
    
    const newServerIds = new Set<string>();
    const removedServerIds = new Set<string>();
    const changedServerIds = new Set<string>();
    const newProcessIds = new Set<number>();
    const removedProcessIds = new Set<number>();
    const changedProcessIds = new Set<number>();
    
    // Check for server changes
    const prevServerIds = new Set(prevState.servers.map(s => s.serverId));
    const currServerIds = new Set(currState.servers.map(s => s.serverId));
    
    for (const server of currState.servers) {
      if (!prevServerIds.has(server.serverId)) {
        logs.push(`Server ${server.serverId} joined (${server.role})`);
        newServerIds.add(server.serverId);
      } else {
        const prevServer = prevState.servers.find(s => s.serverId === server.serverId);
        if (prevServer) {
          if (prevServer.role !== server.role) {
            logs.push(`Server ${server.serverId} role changed: ${prevServer.role} → ${server.role}`);
            changedServerIds.add(server.serverId);
          }
          if (prevServer.status !== server.status) {
            logs.push(`Server ${server.serverId} status changed: ${prevServer.status} → ${server.status}`);
            changedServerIds.add(server.serverId);
          }
        }
      }
    }
    
    for (const serverId of prevServerIds) {
      if (!currServerIds.has(serverId)) {
        logs.push(`Server ${serverId} left`);
        removedServerIds.add(serverId);
      }
    }
    
    // Check for process changes (by nodeId/sid)
    const prevProcesses = new Map<number, {type: string; dbName: string; serverId: string}>();
    const currProcesses = new Map<number, {type: string; dbName: string; serverId: string}>();
    
    prevState.databases.forEach(db => {
      db.processes.forEach(proc => {
        prevProcesses.set(proc.nodeId, {
          type: proc.type,
          dbName: db.name,
          serverId: proc.serverId
        });
      });
    });
    
    currState.databases.forEach(db => {
      db.processes.forEach(proc => {
        currProcesses.set(proc.nodeId, {
          type: proc.type,
          dbName: db.name,
          serverId: proc.serverId
        });
      });
    });
    
    for (const [nodeId, proc] of currProcesses) {
      if (!prevProcesses.has(nodeId)) {
        logs.push(`${proc.type} started on ${proc.serverId} for ${proc.dbName} (sid ${nodeId})`);
        newProcessIds.add(nodeId);
      }
    }
    
    for (const [nodeId, proc] of prevProcesses) {
      if (!currProcesses.has(nodeId)) {
        logs.push(`${proc.type} removed from ${proc.serverId} for ${proc.dbName} (sid ${nodeId})`);
        removedProcessIds.add(nodeId);
      }
    }
    
    // Check for database state changes
    const prevDbStates = new Map(prevState.databases.map(db => [db.name, db.state]));
    const currDbStates = new Map(currState.databases.map(db => [db.name, db.state]));
    
    for (const [dbName, state] of currDbStates) {
      const prevState = prevDbStates.get(dbName);
      if (!prevState) {
        logs.push(`Database ${dbName} state: ${state}`);
      } else if (prevState !== state) {
        logs.push(`Database ${dbName} state changed: ${prevState} → ${state}`);
      }
    }
    
    return {
      logs,
      newServerIds,
      removedServerIds,
      changedServerIds,
      newProcessIds,
      removedProcessIds,
      changedProcessIds,
    };
  }, [currentSnapshot, previousSnapshot]);

  // // Debug logging
  // React.useEffect(() => {
  //   if (changeInfo.logs.length > 0) {
  //     console.log('Domain state changes:', changeInfo);
  //   }
  // }, [changeInfo]);

  if (!isOpen) return null;

  return (
    <div className="domain-state-panel open">
      <div className="domain-state-toggle-container">
        <div className="domain-state-header-title">
          Domain State as of {currentSnapshot ? new Date(currentSnapshot.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '') : ''}
        </div>
        {onNext && onPrev && (
          <div className="domain-state-nav-buttons">
            <button
              className="domain-state-nav-btn"
              onClick={onPrev}
              disabled={!hasPrev}
              title="Previous state"
            >
              ←
            </button>
            <button
              className="domain-state-nav-btn"
              onClick={onNext}
              disabled={!hasNext}
              title="Next state"
            >
              →
            </button>
          </div>
        )}
        <button
          className="domain-state-close-btn"
          onClick={onClose}
          title="Close Domain State panel"
        >
          ✕
        </button>
      </div>
      
      {isOpen && (
        <div className="domain-state-content">
          {!domainState ? (
            <div className="domain-state-empty">
              <p>No domain state available.</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Domain states are loaded from show-database.txt files in the diagnose package admin directories.
              </p>
            </div>
          ) : (
            <>
              <div className="domain-state-header">
                <div className="domain-state-info">
                  <div><strong>Version:</strong> {domainState.serverVersion}</div>
                  <div><strong>License:</strong> {domainState.serverLicense}</div>
                  <div>
                    <strong>Quorum:</strong>{' '}
                    <span className={`quorum-badge ${hasQuorum ? 'has-quorum' : 'no-quorum'}`}>
                      {connectedServers} / {totalServers} {hasQuorum ? '✓' : '✗'} (need {quorumNeeded})
                    </span>
                  </div>
                  {domainState.databases.map(db => (
                    <div key={db.name}>
                      <strong>{db.name}:</strong>{' '}
                      <span className={`db-state-badge db-state-${db.state.toLowerCase()}`}>
                        {db.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="domain-topology" style={{ width: circleSize, height: circleSize, margin: '20px auto' }}>
                {/* SVG for connection lines */}
                <svg 
                  style={{ 
                    position: 'absolute', 
                    left: 0, 
                    top: 0, 
                    width: '100%', 
                    height: '100%', 
                    pointerEvents: 'none' 
                  }}
                >
                  {/* Connection lines from FOLLOWER servers to LEADER */}
                  {nonLeaderServers.map((server, index) => {
                    const position = getServerPosition(index, nonLeaderServers.length);
                    const isFollower = server.role === 'FOLLOWER';
                    const isActive = server.status === 'ACTIVE';
                    
                    return isFollower && isActive && leader ? (
                      <line
                        key={server.serverId}
                        x1={centerX}
                        y1={centerY}
                        x2={position.x}
                        y2={position.y}
                        stroke="var(--accent)"
                        strokeWidth="2"
                        strokeDasharray="4"
                        opacity="0.5"
                      />
                    ) : null;
                  })}
                </svg>
                
                {/* Leader in center */}
                {leader && (
                  <div 
                    className={`server-node leader ${
                      changeInfo.newServerIds.has(leader.serverId) ? 'server-new' :
                      changeInfo.changedServerIds.has(leader.serverId) ? 'server-changed' : ''
                    }`}
                    style={{ 
                      left: `${centerX}px`, 
                      top: `${centerY}px` 
                    }}
                  >
                    <div className="server-node-content">
                      <div className="server-node-header">
                        <div className="server-node-id">{leader.serverId}</div>
                        <div className="server-node-role">LEADER</div>
                      </div>
                      <div className="server-node-processes">
                        {getProcessesForServer(leader.serverId).map((proc, idx) => (
                          <div 
                            key={idx} 
                            className={`process-badge ${proc.type.toLowerCase()} ${
                              proc.isNew ? 'process-new' : 
                              proc.isRemoved ? 'process-removed' : ''
                            }`}
                          >
                            {proc.type} ({proc.nodeId})
                          </div>
                        ))}
                        {/* Show ghost processes that were removed */}
                        {getGhostProcessesForServer(leader.serverId).map((proc, idx) => (
                          <div 
                            key={`ghost-${idx}`} 
                            className={`process-badge ${proc.type.toLowerCase()} process-ghost`}
                          >
                            {proc.type} ({proc.nodeId})
                          </div>
                        ))}
                      </div>
                      <div className="server-node-status">{leader.status}</div>
                    </div>
                  </div>
                )}

                {/* Other servers in circle */}
                {allNonLeaderServers.map((server, index) => {
                  const position = getServerPosition(index, allNonLeaderServers.length);
                  const isGhost = ghostServers.includes(server);
                  const isActive = server.status === 'ACTIVE';
                  const isFollower = server.role === 'FOLLOWER';
                  const isNew = changeInfo.newServerIds.has(server.serverId);
                  const isChanged = changeInfo.changedServerIds.has(server.serverId);
                  
                  return (
                    <div 
                      key={server.serverId}
                      className={`server-node ${isFollower ? 'follower' : ''} ${isActive ? 'active' : 'inactive'} ${
                        isGhost ? 'server-ghost' :
                        isNew ? 'server-new' : isChanged ? 'server-changed' : ''
                      }`}
                      style={{ 
                        left: `${position.x}px`, 
                        top: `${position.y}px` 
                      }}
                    >
                      <div className="server-node-content">
                        <div className="server-node-header">
                          <div className="server-node-id">{server.serverId}</div>
                          <div className="server-node-role">{server.role}</div>
                        </div>
                        <div className="server-node-processes">
                          {!isGhost && getProcessesForServer(server.serverId).map((proc, idx) => (
                            <div 
                              key={idx} 
                              className={`process-badge ${proc.type.toLowerCase()} ${
                                proc.isNew ? 'process-new' : 
                                proc.isRemoved ? 'process-removed' : ''
                              }`}
                            >
                              {proc.type} ({proc.nodeId})
                            </div>
                          ))}
                          {/* For ghost servers, show all their processes as ghosts */}
                          {isGhost && previousSnapshot && previousSnapshot.state.databases.map(db => 
                            db.processes
                              .filter(proc => proc.serverId === server.serverId)
                              .map((proc, idx) => (
                                <div 
                                  key={idx} 
                                  className={`process-badge ${proc.type.toLowerCase()} process-ghost`}
                                >
                                  {proc.type} ({proc.nodeId})
                                </div>
                              ))
                          )}
                          {/* Show ghost processes for non-ghost servers */}
                          {!isGhost && getGhostProcessesForServer(server.serverId).map((proc, idx) => (
                            <div 
                              key={`ghost-${idx}`} 
                              className={`process-badge ${proc.type.toLowerCase()} process-ghost`}
                            >
                              {proc.type} ({proc.nodeId})
                            </div>
                          ))}
                        </div>
                        <div className="server-node-status">{server.status}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Change logs */}
              {changeInfo.logs.length > 0 && (
                <div className="domain-state-changes">
                  <div className="changes-header">Changes from previous state:</div>
                  <div className="changes-list">
                    {changeInfo.logs.map((change, idx) => (
                      <div key={idx} className="change-log">
                        • {change}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
