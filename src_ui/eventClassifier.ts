import type { DbStates, EventType } from './types';

export type ClassifiedEvents = {
  processEvents: EventType[];
  databaseEvents: EventType[];
  unclassifiedEvents: EventType[];
};

export function classifyEvents(
  events: EventType[],
  dbStates: DbStates
): ClassifiedEvents {
  const processEvents: EventType[] = [];
  const databaseEvents: EventType[] = [];
  const unclassifiedEvents: EventType[] = [];

  for (const e of events) {
    const msg = e.message ?? '';
    const raw = e.raw ?? '';

    // Check if it's a process event (has startId, start-id, or sid parameters)
    const hasProcessId =
      /\b(?:startIds?|start-id|sid)[:=]/.test(msg) ||
      /\b(?:startIds?|start-id|sid)[:=]/.test(raw);
    if (hasProcessId) {
      processEvents.push(e);
      continue;
    }

    // All DomainProcessStateMachine events without sid are AP events
    const isDomainProcessStateMachine =
      /DomainProcessStateMachine/.test(msg) ||
      /DomainProcessStateMachine/.test(raw);
    if (isDomainProcessStateMachine) {
      processEvents.push(e);
      continue;
    }

    // Check if it's a database event - has dbName parameter
    const hasDatabaseName =
      /\bdbName[:=]/.test(msg) || /\bdbName[:=]/.test(raw);
    if (hasDatabaseName) {
      databaseEvents.push(e);
      continue;
    }

    // Everything else is unclassified
    unclassifiedEvents.push(e);
  }

  return { processEvents, databaseEvents, unclassifiedEvents };
}
