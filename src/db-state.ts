// Database state management and segment building

import type { DbStateEvent, DbStateSegment, LogEvent } from './types';
import { dbStateEvents } from './parsers';

/**
 * Build database state segments per database name
 */
export function buildDbStates(events: LogEvent[]): Record<string, DbStateSegment[]> {
	const dbStates: Record<string, DbStateSegment[]> = {};
	const byDb: Record<string, DbStateEvent[]> = {};

	// Group database state events by database name
	for (const e of dbStateEvents) {
		(byDb[e.dbName] ||= []).push(e);
	}

	// Build segments for each database
	for (const [db, arr] of Object.entries(byDb)) {
		arr.sort((a, b) => a.ts - b.ts);
		if (!arr.length) {
			dbStates[db] = [];
			continue;
		}

		const segs: DbStateSegment[] = [];
		const lastEvent = events[events.length - 1];

		for (let i = 0; i < arr.length; i++) {
			const cur = arr[i]!;
			const next = arr[i + 1];
			segs.push({
				state: cur.state,
				start: cur.ts,
				end: next ? next.ts : lastEvent?.ts ?? cur.ts + 1,
				iso: cur.iso,
				message: cur.message,
			});
		}
		dbStates[db] = segs;
	}

	return dbStates;
}
