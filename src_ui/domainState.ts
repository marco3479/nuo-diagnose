import type { DomainStateSnapshot } from './types';

export function mergeDomainStates(
  referenceStates: DomainStateSnapshot[],
  inferredStates: DomainStateSnapshot[]
): DomainStateSnapshot[] {
  if (referenceStates.length === 0) {
    return [...inferredStates].sort((a, b) => a.timestamp - b.timestamp);
  }

  const sortedReferences = [...referenceStates].sort((a, b) => a.timestamp - b.timestamp);

  const inferredWithReferenceMetadata = inferredStates.map((inferredState) => {
    let selectedReference = sortedReferences[0] ?? null;

    for (const referenceState of sortedReferences) {
      if (referenceState.timestamp <= inferredState.timestamp) {
        selectedReference = referenceState;
        continue;
      }
      break;
    }

    if (!selectedReference) {
      return inferredState;
    }

    return {
      ...inferredState,
      state: {
        ...inferredState.state,
        serverVersion: selectedReference.state.serverVersion || inferredState.state.serverVersion,
        serverLicense: selectedReference.state.serverLicense || inferredState.state.serverLicense,
        clientToken: selectedReference.state.clientToken || inferredState.state.clientToken,
      },
    };
  });

  return [...inferredWithReferenceMetadata, ...sortedReferences].sort(
    (a, b) => a.timestamp - b.timestamp
  );
}

export function getVisibleDomainStateTimestamps(
  domainStates: DomainStateSnapshot[],
  start: number,
  end: number
): number[] {
  const timestamps = new Set<number>();
  for (const snapshot of domainStates) {
    if (snapshot.timestamp >= start && snapshot.timestamp <= end) {
      timestamps.add(snapshot.timestamp);
    }
  }
  return Array.from(timestamps).sort((a, b) => a - b);
}

export function clampCurrentTimePoint(
  currentTimePoint: number | null,
  visibleTimestamps: number[]
): number | null {
  if (visibleTimestamps.length === 0) {
    return currentTimePoint;
  }

  const firstVisible = visibleTimestamps[0] ?? null;
  const lastVisible = visibleTimestamps[visibleTimestamps.length - 1] ?? null;

  if (firstVisible === null || lastVisible === null) {
    return currentTimePoint;
  }

  if (currentTimePoint === null) {
    return firstVisible;
  }

  if (currentTimePoint < firstVisible) {
    return firstVisible;
  }

  if (currentTimePoint > lastVisible) {
    return lastVisible;
  }

  return currentTimePoint;
}

export function getAdjacentTimePoint(
  visibleTimestamps: number[],
  currentTimePoint: number | null,
  direction: 'next' | 'prev',
  fallback: number
): number | null {
  if (visibleTimestamps.length === 0) {
    return null;
  }

  if (currentTimePoint === null) {
    return direction === 'next'
      ? (visibleTimestamps[0] ?? fallback)
      : (visibleTimestamps[visibleTimestamps.length - 1] ?? fallback);
  }

  let currentIndex = -1;
  for (let index = 0; index < visibleTimestamps.length; index += 1) {
    const timestamp = visibleTimestamps[index];
    if (timestamp !== undefined && timestamp <= currentTimePoint) {
      currentIndex = index;
      continue;
    }
    break;
  }

  const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  return visibleTimestamps[targetIndex] ?? currentTimePoint;
}

export function getCurrentDomainStateSnapshot(
  visibleDomainStates: DomainStateSnapshot[],
  currentTimePoint: number | null
): DomainStateSnapshot | null {
  if (currentTimePoint === null || visibleDomainStates.length === 0) {
    return null;
  }

  const statesBeforeOrAt = visibleDomainStates.filter(
    (snapshot) => snapshot.timestamp <= currentTimePoint
  );

  return statesBeforeOrAt[statesBeforeOrAt.length - 1] ?? null;
}

export function getPreviousDomainStateSnapshot(
  visibleDomainStates: DomainStateSnapshot[],
  currentSnapshot: DomainStateSnapshot | null
): DomainStateSnapshot | null {
  if (!currentSnapshot || visibleDomainStates.length === 0) {
    return null;
  }

  const currentIndex = visibleDomainStates.findIndex(
    (snapshot) => snapshot.timestamp === currentSnapshot.timestamp
  );

  if (currentIndex <= 0) {
    return null;
  }

  return visibleDomainStates[currentIndex - 1] ?? null;
}

export function getDomainStateFrame(
  visibleDomainStates: DomainStateSnapshot[],
  currentSnapshot: DomainStateSnapshot | null
): number {
  if (!currentSnapshot || visibleDomainStates.length === 0) {
    return 0;
  }

  const currentIndex = visibleDomainStates.findIndex(
    (snapshot) => snapshot.timestamp === currentSnapshot.timestamp
  );

  return currentIndex >= 0 ? currentIndex + 1 : 0;
}
