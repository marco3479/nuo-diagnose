// Build inferred domain states from events and instances

import type { LogEvent } from './types';
import type { DomainState, DomainServer, DomainDatabase, DomainProcess } from './domain-state-parser';
import { dbStateEvents } from './parsers';

export type Instance = {
	process: string;
	sid: number;
	start: number;
	end: number;
	firstIso?: string;
	lastIso?: string;
	type?: string;
	address?: string;
};

/**
 * Build inferred domain states from events and process instances
 */
export function buildInferredDomainStates(
	events: LogEvent[],
	instances: Instance[],
	startTime: number,
	endTime: number
): Array<{ timestamp: number; iso: string; state: DomainState }> {
	const inferredStates: Array<{ timestamp: number; iso: string; state: DomainState }> = [];
	
	// First, determine which processes have explicit removal events
	const removedSids = new Map<number, number>(); // sid -> removal timestamp
	for (const event of events) {
		if (/RemoveNodeCommand|ShutdownNodesCommand|ShutdownNodeCommand/i.test(event.message || '')) {
			const sidMatch = event.message?.match(/startId[:\s=]+(\d+)/i);
			if (sidMatch) {
				const sid = parseInt(sidMatch[1]);
				removedSids.set(sid, event.ts);
			}
		}
	}
	
	// Get all significant timestamps where state changes occur
	const changeTimestamps = new Set<number>();
	
	// Add process start times and explicit end times (only for removed processes)
	for (const inst of instances) {
		changeTimestamps.add(inst.start);
		// Only add end time if this process was explicitly removed
		if (removedSids.has(inst.sid)) {
			const removalTime = removedSids.get(inst.sid)!;
			changeTimestamps.add(removalTime);
		}
	}
	
	// Add database state change times
	for (const dbStateEvent of dbStateEvents) {
		changeTimestamps.add(dbStateEvent.ts);
	}
	
	// Add instance start timestamps (when new processes actually start)
	for (const inst of instances) {
		changeTimestamps.add(inst.start);
	}
	
	// Sort timestamps
	const sortedTimestamps = Array.from(changeTimestamps).sort((a, b) => a - b);
	
	// Build a state snapshot for each timestamp
	for (const ts of sortedTimestamps) {
		const state = buildStateAtTimestamp(ts, instances, events, endTime);
		if (state) {
			inferredStates.push({
				timestamp: ts,
				iso: new Date(ts).toISOString(),
				state,
			});
		}
	}
	
	return inferredStates;
}

/**
 * Build domain state at a specific timestamp
 */
function buildStateAtTimestamp(
	timestamp: number,
	instances: Instance[],
	events: LogEvent[],
	endTime: number
): DomainState | null {
	// Check which processes have explicit removal/shutdown events
	const removedSids = new Set<number>();
	for (const event of events) {
		if (event.ts <= timestamp && /RemoveNodeCommand|ShutdownNodesCommand|ShutdownNodeCommand/i.test(event.message || '')) {
			// Extract sid from the event message
			const sidMatch = event.message?.match(/startId[:\s=]+(\d+)/i);
			if (sidMatch) {
				const sid = parseInt(sidMatch[1]);
				removedSids.add(sid);
			}
		}
	}
	
	// Get all active instances at this timestamp
	const activeInstances = instances.filter(inst => {
		// Must have started (inclusive - process starting exactly at timestamp is included)
		if (inst.start > timestamp) {
			return false;
		}
		
		// Determine effective end time: if explicitly removed, use actual end time,
		// otherwise assume still running (use endTime parameter)
		const wasRemoved = removedSids.has(inst.sid);
		const effectiveEnd = wasRemoved ? inst.end : endTime;
		
		// Check if instance is active at this timestamp
		return effectiveEnd >= timestamp;
	});
	
	if (activeInstances.length === 0) {
		return null;
	}
	
	// Group by database and server
	const serverMap = new Map<string, Set<string>>();
	const dbMap = new Map<string, DomainProcess[]>();
	
	for (const inst of activeInstances) {
		const serverId = inst.address || 'unknown';
		
		// Track servers
		if (!serverMap.has(serverId)) {
			serverMap.set(serverId, new Set());
		}
		
		// Create process entry
		const processType = inst.type === 'TE' || inst.type === 'SM' ? inst.type : 
			(inst.process.includes('Engine') ? 'TE' : 'SM');
		
		// Extract database name from process string (e.g., "Engine(conv,1)")
		const dbMatch = inst.process.match(/\(([^,]+)/);
		const dbName = dbMatch ? dbMatch[1] : 'unknown';
		
		const process: DomainProcess = {
			type: processType as 'TE' | 'SM',
			address: inst.address || 'unknown',
			port: 48006, // Default port, would need to parse from events
			startId: inst.sid,
			serverId: serverId,
			pid: 0, // Not available from our data
			nodeId: inst.sid,
			lastAck: 0, // Not available from our data
			status: 'MONITORED:RUNNING',
		};
		
		if (!dbMap.has(dbName)) {
			dbMap.set(dbName, []);
		}
		dbMap.get(dbName)!.push(process);
	}
	
	// Build servers list
	const servers: DomainServer[] = Array.from(serverMap.keys()).map(serverId => ({
		serverId,
		address: serverId,
		port: 48005,
		lastAck: 0,
		status: 'ACTIVE Connected',
		role: 'UNKNOWN',
	}));
	
	// Get database states at this timestamp
	const databases: DomainDatabase[] = Array.from(dbMap.entries()).map(([dbName, processes]) => {
		// Find the most recent database state before or at this timestamp
		const dbState = dbStateEvents
			.filter(evt => evt.dbName === dbName && evt.ts <= timestamp)
			.sort((a, b) => b.ts - a.ts)[0];
		
		return {
			name: dbName,
			state: dbState ? dbState.state : 'UNKNOWN',
			processes,
		};
	});
	
	return {
		serverVersion: 'inferred',
		serverLicense: 'inferred',
		serverTime: new Date(timestamp).toISOString(),
		clientToken: '',
		servers,
		databases,
		raw: '(inferred from events)',
	};
}
