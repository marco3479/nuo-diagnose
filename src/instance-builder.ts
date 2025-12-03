// Instance building logic from startId occurrences

import type { Instance, LogEvent } from './types';
import { startIdOccurrences, sidTypeMap, sidAddressMap } from './parsers';

/**
 * Build instances from startId occurrences, grouped by sid
 */
export function buildInstances(events: LogEvent[]): Instance[] {
	// Build map of which sids have an authoritative start
	const sidHasStart: Record<number, boolean> = {};
	for (const occ of startIdOccurrences) {
		if (occ.isStart) sidHasStart[occ.sid] = true;
	}

	// Build instances from startId occurrences: group by sid only (not by logging process)
	const instancesMap: Record<
		string,
		{
			process: string;
			sid: number;
			start: number;
			end: number;
			firstIso?: string;
			lastIso?: string;
			type?: string;
			address?: string;
		}
	> = {};

	for (const occ of startIdOccurrences) {
		const key = `${occ.sid}`;
		if (!instancesMap[key]) {
			instancesMap[key] = {
				process: occ.process,
				sid: occ.sid,
				start: occ.ts,
				end: occ.ts,
				firstIso: occ.iso,
				lastIso: occ.iso,
				type: occ.type,
				address: occ.address,
			};
		} else {
			const cur = instancesMap[key];
			if (occ.ts < cur.start) {
				cur.start = occ.ts;
				cur.firstIso = occ.iso;
			}
			if (occ.ts > cur.end) {
				cur.end = occ.ts;
				cur.lastIso = occ.iso;
			}
			// Prefer setting type/address if present
			if (!cur.type && occ.type) cur.type = occ.type;
			// Prefer non-<LOCAL addresses over existing ones
			if (occ.address && (!cur.address || (cur.address.startsWith('<LOCAL') && !occ.address.startsWith('<LOCAL')))) {
				cur.address = occ.address;
			}
		}
	}

	const first = events[0];

	// If a sid has no start, assume it began at the very beginning
	if (first && events.length > 0) {
		for (const [key, inst] of Object.entries(instancesMap)) {
			const sid = inst.sid;
			if (!sidHasStart[sid]) {
				inst.start = Math.min(inst.start, first.ts);
				inst.firstIso = first.iso;
			}
		}
	}

	// Backfill missing type/address from side maps if still absent
	for (const i of Object.values(instancesMap)) {
		if (!i.type && sidTypeMap[i.sid]) i.type = sidTypeMap[i.sid];
		if (!i.address && sidAddressMap[i.sid]) i.address = sidAddressMap[i.sid];
	}

	const instances = Object.values(instancesMap).map((i) => ({
		process: i.process,
		sid: i.sid,
		start: i.start,
		end: i.end,
		firstIso: i.firstIso,
		lastIso: i.lastIso,
		type: i.type,
		address: i.address,
	}));

	return instances;
}
