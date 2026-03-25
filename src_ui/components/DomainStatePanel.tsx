import React, { type JSX } from 'react';
import type { DomainStateSnapshot } from '../types';
import { DomainStateTopology } from './domain-state/DomainStateTopology';
import {
  getChangeInfo,
  getCircleLayout,
  getGhostServers,
  getOrderedNonLeaderServers,
  getQuorumInfo,
} from './domain-state/helpers';

type DomainStatePanelProps = {
  currentSnapshot: DomainStateSnapshot | null;
  previousSnapshot: DomainStateSnapshot | null;
  currentFrame?: number;
  totalFrames?: number;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
};

export function DomainStatePanel({
  currentSnapshot,
  previousSnapshot,
  currentFrame = 0,
  totalFrames = 0,
  isOpen,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: DomainStatePanelProps): JSX.Element | null {
  const domainState = currentSnapshot?.state ?? null;
  const leader = domainState?.servers.find((server) => server.role === 'LEADER');
  const followers = domainState?.servers.filter((server) => server.role === 'FOLLOWER') ?? [];
  const otherServers = domainState?.servers.filter((server) => server.role !== 'LEADER' && server.role !== 'FOLLOWER') ?? [];
  const nonLeaderServers = [...followers, ...otherServers];

  const ghostServers = React.useMemo(
    () => getGhostServers(previousSnapshot, currentSnapshot),
    [previousSnapshot, currentSnapshot]
  );
  const allNonLeaderServers = React.useMemo(
    () => getOrderedNonLeaderServers(nonLeaderServers, ghostServers, previousSnapshot),
    [ghostServers, nonLeaderServers, previousSnapshot]
  );
  const changeInfo = React.useMemo(
    () => getChangeInfo(currentSnapshot, previousSnapshot),
    [currentSnapshot, previousSnapshot]
  );
  const { circleSize, centerX, centerY, radius } = getCircleLayout(Boolean(leader), allNonLeaderServers.length);
  const { totalServers, connectedServers, quorumNeeded, hasQuorum } = getQuorumInfo(currentSnapshot);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="domain-state-panel open">
      <div className="domain-state-toggle-container">
        <div className="domain-state-header-title">
          Domain State as of {currentSnapshot ? new Date(currentSnapshot.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '') : ''}
        </div>
        {onNext && onPrev && (
          <div className="domain-state-nav-buttons">
            <button className="domain-state-nav-btn" onClick={onPrev} disabled={!hasPrev} title="Previous state">←</button>
            {totalFrames > 0 && <div className="domain-state-nav-count">{Math.max(0, currentFrame)}/{totalFrames}</div>}
            <button className="domain-state-nav-btn" onClick={onNext} disabled={!hasNext} title="Next state">→</button>
          </div>
        )}
        <button className="domain-state-close-btn" onClick={onClose} title="Close Domain State panel">✕</button>
      </div>

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
                <div>
                  <strong>Quorum:</strong>{' '}
                  <span className={`quorum-badge ${hasQuorum ? 'has-quorum' : 'no-quorum'}`}>
                    {connectedServers} / {totalServers} {hasQuorum ? '✓' : '✗'} (need {quorumNeeded})
                  </span>
                </div>
                {domainState.databases.map((database) => (
                  <div key={database.name}>
                    <strong>{database.name}:</strong>{' '}
                    <span className={`db-state-badge db-state-${database.state.toLowerCase()}`}>
                      {database.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <DomainStateTopology
              leader={leader}
              nonLeaderServers={nonLeaderServers}
              allNonLeaderServers={allNonLeaderServers}
              ghostServers={ghostServers}
              changeInfo={changeInfo}
              previousSnapshot={previousSnapshot}
              currentSnapshot={currentSnapshot}
              circleSize={circleSize}
              centerX={centerX}
              centerY={centerY}
              radius={radius}
            />

            {changeInfo.logs.length > 0 && (
              <div className="domain-state-changes">
                <div className="changes-header">Changes from previous state:</div>
                <div className="changes-list">
                  {changeInfo.logs.map((change, index) => (
                    <div key={`${change}-${index}`} className="change-log">• {change}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
