import type { JSX } from 'react';
import type { DomainServer, DomainStateSnapshot } from '../../types';
import {
  getDisplayRole,
  getGhostProcessesForServer,
  getProcessesForServer,
  getServerPosition,
  isActiveStatus,
  type ChangeInfo,
} from './helpers';

type DomainStateTopologyProps = {
  leader: DomainServer | undefined;
  nonLeaderServers: DomainServer[];
  allNonLeaderServers: DomainServer[];
  ghostServers: DomainServer[];
  changeInfo: ChangeInfo;
  previousSnapshot: DomainStateSnapshot | null;
  currentSnapshot: DomainStateSnapshot | null;
  circleSize: number;
  centerX: number;
  centerY: number;
  radius: number;
};

export function DomainStateTopology({
  leader,
  nonLeaderServers,
  allNonLeaderServers,
  ghostServers,
  changeInfo,
  previousSnapshot,
  currentSnapshot,
  circleSize,
  centerX,
  centerY,
  radius,
}: DomainStateTopologyProps): JSX.Element {
  return (
    <div className="domain-topology" style={{ width: circleSize, height: circleSize, margin: '20px auto' }}>
      <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {nonLeaderServers.map((server, index) => {
          const position = getServerPosition(centerX, centerY, radius, index, nonLeaderServers.length);
          const isFollower = server.role === 'FOLLOWER';
          const isActive = isActiveStatus(server.status);

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

      {leader && (
        <div
          className={`server-node leader ${changeInfo.newServerIds.has(leader.serverId) ? 'server-new' : changeInfo.changedServerIds.has(leader.serverId) ? 'server-changed' : ''}`}
          style={{ left: `${centerX}px`, top: `${centerY}px` }}
        >
          <div className="server-node-content">
            <div className="server-node-header">
              <div className="server-node-id">{leader.serverId}</div>
              <div className="server-node-role">LEADER</div>
            </div>
            <div className="server-node-processes">
              {getProcessesForServer(currentSnapshot, leader.serverId, changeInfo).map((process) => (
                <div
                  key={`${process.type}-${process.nodeId}`}
                  className={`process-badge ${process.type.toLowerCase()} ${process.isNew ? 'process-new' : process.isRemoved ? 'process-removed' : ''}`}
                >
                  {process.type} ({process.nodeId})
                </div>
              ))}
              {getGhostProcessesForServer(previousSnapshot, currentSnapshot, leader.serverId).map((process) => (
                <div key={`ghost-${process.type}-${process.nodeId}`} className={`process-badge ${process.type.toLowerCase()} process-ghost`}>
                  {process.type} ({process.nodeId})
                </div>
              ))}
            </div>
            <div className="server-node-status">{leader.status}</div>
          </div>
        </div>
      )}

      {allNonLeaderServers.map((server, index) => {
        const position = getServerPosition(centerX, centerY, radius, index, allNonLeaderServers.length);
        const isGhost = ghostServers.some((candidate) => candidate.serverId === server.serverId);
        const isActive = isActiveStatus(server.status);
        const isFollower = server.role === 'FOLLOWER';
        const isNew = changeInfo.newServerIds.has(server.serverId);
        const isChanged = changeInfo.changedServerIds.has(server.serverId);
        const displayRole = getDisplayRole(server.role);

        return (
          <div
            key={server.serverId}
            className={`server-node ${isFollower ? 'follower' : ''} ${isActive ? 'active' : 'inactive'} ${isGhost ? 'server-ghost' : isNew ? 'server-new' : isChanged ? 'server-changed' : ''}`}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
          >
            <div className="server-node-content">
              <div className="server-node-header">
                <div className="server-node-id">{server.serverId}</div>
                {displayRole && <div className="server-node-role">{displayRole}</div>}
              </div>
              <div className="server-node-processes">
                {!isGhost &&
                  getProcessesForServer(currentSnapshot, server.serverId, changeInfo).map((process) => (
                    <div
                      key={`${process.type}-${process.nodeId}`}
                      className={`process-badge ${process.type.toLowerCase()} ${process.isNew ? 'process-new' : process.isRemoved ? 'process-removed' : ''}`}
                    >
                      {process.type} ({process.nodeId})
                    </div>
                  ))}
                {isGhost &&
                  previousSnapshot?.state.databases.flatMap((database) =>
                    database.processes
                      .filter((process) => process.serverId === server.serverId)
                      .map((process) => (
                        <div key={`${database.name}-${process.nodeId}`} className={`process-badge ${process.type.toLowerCase()} process-ghost`}>
                          {process.type} ({process.nodeId})
                        </div>
                      ))
                  )}
                {!isGhost &&
                  getGhostProcessesForServer(previousSnapshot, currentSnapshot, server.serverId).map((process) => (
                    <div key={`ghost-${process.type}-${process.nodeId}`} className={`process-badge ${process.type.toLowerCase()} process-ghost`}>
                      {process.type} ({process.nodeId})
                    </div>
                  ))}
              </div>
              <div className="server-node-status">{server.status}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
