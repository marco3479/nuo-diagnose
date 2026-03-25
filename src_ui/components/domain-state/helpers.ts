import type { DomainServer, DomainStateSnapshot } from '../../types';

export type ChangeInfo = {
  logs: string[];
  newServerIds: Set<string>;
  removedServerIds: Set<string>;
  changedServerIds: Set<string>;
  newProcessIds: Set<number>;
  removedProcessIds: Set<number>;
  changedProcessIds: Set<number>;
};

export type DomainProcessDisplay = {
  type: string;
  dbName: string;
  status: string;
  nodeId: number;
  isNew?: boolean;
  isRemoved?: boolean;
};

export type DomainGhostProcessDisplay = {
  type: string;
  dbName: string;
  nodeId: number;
};

export function getDisplayRole(role?: string): string | null {
  if (!role || role === 'UNKNOWN') {
    return null;
  }
  return role;
}

export function isActiveStatus(status?: string): boolean {
  return typeof status === 'string' && status.startsWith('ACTIVE');
}

export function getGhostServers(
  previousSnapshot: DomainStateSnapshot | null,
  currentSnapshot: DomainStateSnapshot | null
): DomainServer[] {
  if (!previousSnapshot || !currentSnapshot) {
    return [];
  }

  const currentServerIds = new Set(currentSnapshot.state.servers.map((server) => server.serverId));
  return previousSnapshot.state.servers.filter(
    (server) => !currentServerIds.has(server.serverId) && server.role !== 'LEADER'
  );
}

export function getOrderedNonLeaderServers(
  currentServers: DomainServer[],
  ghostServers: DomainServer[],
  previousSnapshot: DomainStateSnapshot | null
): DomainServer[] {
  if (!previousSnapshot) {
    return currentServers;
  }

  const previousOrder = previousSnapshot.state.servers
    .filter((server) => server.role !== 'LEADER')
    .map((server) => server.serverId);

  const serverMap = new Map<string, DomainServer>();
  currentServers.forEach((server) => serverMap.set(server.serverId, server));
  ghostServers.forEach((server) => serverMap.set(server.serverId, server));

  const orderedServers = previousOrder
    .filter((serverId) => serverMap.has(serverId))
    .map((serverId) => serverMap.get(serverId))
    .filter((server): server is DomainServer => Boolean(server));

  const previousOrderSet = new Set(previousOrder);
  currentServers.forEach((server) => {
    if (!previousOrderSet.has(server.serverId)) {
      orderedServers.push(server);
    }
  });

  return orderedServers;
}

export function getProcessesForServer(
  currentSnapshot: DomainStateSnapshot | null,
  serverId: string,
  changeInfo: ChangeInfo
): DomainProcessDisplay[] {
  if (!currentSnapshot) {
    return [];
  }

  const processes: DomainProcessDisplay[] = [];
  currentSnapshot.state.databases.forEach((database) => {
    database.processes.forEach((process) => {
      if (process.serverId === serverId) {
        processes.push({
          type: process.type,
          dbName: database.name,
          status: process.status,
          nodeId: process.nodeId,
          isNew: changeInfo.newProcessIds.has(process.nodeId),
          isRemoved: changeInfo.removedProcessIds.has(process.nodeId),
        });
      }
    });
  });

  return processes;
}

export function getGhostProcessesForServer(
  previousSnapshot: DomainStateSnapshot | null,
  currentSnapshot: DomainStateSnapshot | null,
  serverId: string
): DomainGhostProcessDisplay[] {
  if (!previousSnapshot || !currentSnapshot) {
    return [];
  }

  const currentProcessIds = new Set<number>();
  currentSnapshot.state.databases.forEach((database) => {
    database.processes.forEach((process) => {
      if (process.serverId === serverId) {
        currentProcessIds.add(process.nodeId);
      }
    });
  });

  const ghostProcesses: DomainGhostProcessDisplay[] = [];
  previousSnapshot.state.databases.forEach((database) => {
    database.processes.forEach((process) => {
      if (process.serverId === serverId && !currentProcessIds.has(process.nodeId)) {
        ghostProcesses.push({
          type: process.type,
          dbName: database.name,
          nodeId: process.nodeId,
        });
      }
    });
  });

  return ghostProcesses;
}

export function getCircleLayout(hasLeader: boolean, serverCount: number) {
  const baseSize = hasLeader ? 400 : 300;
  const sizeIncrement = hasLeader ? 50 : 40;
  const maxSize = hasLeader ? 800 : 600;
  const circleSize = Math.min(maxSize, Math.max(baseSize, baseSize + serverCount * sizeIncrement));
  const centerX = circleSize / 2;
  const centerY = circleSize / 2;
  const marginForNode = 80;
  const radius = hasLeader ? circleSize / 2 - marginForNode - 20 : circleSize / 2 - marginForNode;

  return { circleSize, centerX, centerY, radius };
}

export function getServerPosition(
  centerX: number,
  centerY: number,
  radius: number,
  index: number,
  total: number
) {
  const angle = (index * 2 * Math.PI) / total - Math.PI / 2;
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

export function getQuorumInfo(currentSnapshot: DomainStateSnapshot | null) {
  const totalServers = currentSnapshot?.state.servers.length ?? 0;
  const connectedServers =
    currentSnapshot?.state.servers.filter((server) => server.status.includes('Connected')).length ?? 0;
  const quorumNeeded = totalServers === 1 ? 2 : Math.floor(totalServers / 2) + 1;
  const hasQuorum = connectedServers >= quorumNeeded;

  return { totalServers, connectedServers, quorumNeeded, hasQuorum };
}

export function getChangeInfo(
  currentSnapshot: DomainStateSnapshot | null,
  previousSnapshot: DomainStateSnapshot | null
): ChangeInfo {
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
  const previousState = previousSnapshot.state;
  const currentState = currentSnapshot.state;
  const newServerIds = new Set<string>();
  const removedServerIds = new Set<string>();
  const changedServerIds = new Set<string>();
  const newProcessIds = new Set<number>();
  const removedProcessIds = new Set<number>();
  const changedProcessIds = new Set<number>();

  const previousServerIds = new Set(previousState.servers.map((server) => server.serverId));
  const currentServerIds = new Set(currentState.servers.map((server) => server.serverId));

  for (const server of currentState.servers) {
    if (!previousServerIds.has(server.serverId)) {
      const displayRole = getDisplayRole(server.role);
      logs.push(displayRole ? `Server ${server.serverId} joined (${displayRole})` : `Server ${server.serverId} joined`);
      newServerIds.add(server.serverId);
      continue;
    }

    const previousServer = previousState.servers.find(
      (candidate) => candidate.serverId === server.serverId
    );
    if (!previousServer) {
      continue;
    }

    const previousRole = getDisplayRole(previousServer.role);
    const currentRole = getDisplayRole(server.role);
    if (previousRole !== currentRole && (previousRole || currentRole)) {
      logs.push(`Server ${server.serverId} role changed: ${previousRole ?? 'none'} → ${currentRole ?? 'none'}`);
      changedServerIds.add(server.serverId);
    }
    if (previousServer.status !== server.status) {
      logs.push(`Server ${server.serverId} status changed: ${previousServer.status} → ${server.status}`);
      changedServerIds.add(server.serverId);
    }
  }

  for (const serverId of previousServerIds) {
    if (!currentServerIds.has(serverId)) {
      logs.push(`Server ${serverId} left`);
      removedServerIds.add(serverId);
    }
  }

  const previousProcesses = new Map<number, { type: string; dbName: string; serverId: string }>();
  const currentProcesses = new Map<number, { type: string; dbName: string; serverId: string }>();

  previousState.databases.forEach((database) => {
    database.processes.forEach((process) => {
      previousProcesses.set(process.nodeId, {
        type: process.type,
        dbName: database.name,
        serverId: process.serverId,
      });
    });
  });

  currentState.databases.forEach((database) => {
    database.processes.forEach((process) => {
      currentProcesses.set(process.nodeId, {
        type: process.type,
        dbName: database.name,
        serverId: process.serverId,
      });
    });
  });

  for (const [nodeId, process] of currentProcesses) {
    if (!previousProcesses.has(nodeId)) {
      logs.push(`${process.type} started on ${process.serverId} for ${process.dbName} (sid ${nodeId})`);
      newProcessIds.add(nodeId);
    }
  }

  for (const [nodeId, process] of previousProcesses) {
    if (!currentProcesses.has(nodeId)) {
      logs.push(`${process.type} removed from ${process.serverId} for ${process.dbName} (sid ${nodeId})`);
      removedProcessIds.add(nodeId);
    }
  }

  const previousDbStates = new Map(previousState.databases.map((database) => [database.name, database.state]));
  const currentDbStates = new Map(currentState.databases.map((database) => [database.name, database.state]));

  for (const [databaseName, state] of currentDbStates) {
    const previousDatabaseState = previousDbStates.get(databaseName);
    if (!previousDatabaseState) {
      logs.push(`Database ${databaseName} state: ${state}`);
    } else if (previousDatabaseState !== state) {
      logs.push(`Database ${databaseName} state changed: ${previousDatabaseState} → ${state}`);
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
}
