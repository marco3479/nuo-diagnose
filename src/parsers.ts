// Log parsing functions for NuoAdmin logs

import type { LogEvent, FailureProtocolEvent, StartOcc, DbStateEvent } from './types';

// Shared state for tracking occurrences and mappings
export let startIdOccurrences: StartOcc[] = [];
export const sidTypeMap: Record<number, string> = {};
export const sidAddressMap: Record<number, string> = {};
export let dbStateEvents: DbStateEvent[] = [];
export let failureProtocolEvents: FailureProtocolEvent[] = [];

export function resetParserState() {
	startIdOccurrences = [];
	for (const k of Object.keys(sidTypeMap)) delete sidTypeMap[k];
	for (const k of Object.keys(sidAddressMap)) delete sidAddressMap[k];
	dbStateEvents = [];
	failureProtocolEvents = [];
}

/**
 * Extract DatabaseInfo content by counting braces
 */
function extractDbInfo(text: string, marker: string): string | null {
	const startIdx = text.indexOf(marker);
	if (startIdx === -1) return null;
	const openIdx = text.indexOf('{', startIdx);
	if (openIdx === -1) return null;
	let depth = 1;
	let i = openIdx + 1;
	while (i < text.length && depth > 0) {
		if (text[i] === '{') depth++;
		else if (text[i] === '}') depth--;
		i++;
	}
	return depth === 0 ? text.substring(openIdx + 1, i - 1) : null;
}

/**
 * Parse DatabaseInfo string into key-value object
 */
function parseDbInfo(str: string): Record<string, any> {
	const obj: Record<string, any> = {};
	let i = 0;
	while (i < str.length) {
		// Skip whitespace
		while (i < str.length && /\s/.test(str[i])) i++;
		if (i >= str.length) break;

		// Find next key (letters, numbers, hyphens)
		const eqIdx = str.indexOf('=', i);
		if (eqIdx === -1) break;

		const key = str.substring(i, eqIdx).trim();
		if (!key) {
			i = eqIdx + 1;
			continue;
		}

		// Find value (until comma or end, respecting braces)
		let valStart = eqIdx + 1;
		let valEnd = valStart;
		let depth = 0;
		while (valEnd < str.length) {
			if (str[valEnd] === '{') depth++;
			else if (str[valEnd] === '}') depth--;
			else if (str[valEnd] === ',' && depth === 0) break;
			valEnd++;
		}
		const value = str.substring(valStart, valEnd).trim();
		obj[key] = value;
		i = valEnd + 1; // Skip comma and continue
	}
	return obj;
}

/**
 * Extract database diff from update message
 */
function parseDbDiff(message: string) {
	if (!/Updated database from DatabaseInfo\{/.test(message)) {
		return undefined;
	}

	const fromContent = extractDbInfo(message, 'from DatabaseInfo{');
	const toContent = extractDbInfo(message, 'to DatabaseInfo{');

	if (fromContent && toContent) {
		return {
			from: parseDbInfo(fromContent),
			to: parseDbInfo(toContent),
		};
	}
	return undefined;
}

/**
 * Extract startId/sid from message, prioritizing target over reason parameter
 */
function extractSid(message: string, raw: string): number | null {
	// For commands being applied (RemoveNodeCommand, etc.), use the first startId BEFORE "reason="
	// since that's the target. The startId in the reason parameter is secondary.
	const reasonIndex = message.indexOf('reason=');
	if (reasonIndex > 0) {
		const beforeReason = message.substring(0, reasonIndex);
		const sidMatch = beforeReason.match(/\b(?:startId|start-id|sid)=(\d+)\b/i);
		if (sidMatch) return Number(sidMatch[1]);
	}

	// If no startId found before reason, or no reason param, check the full message
	const sidMatch = message.match(/\b(?:startId|start-id|sid)=(\d+)\b/i) || raw.match(/\b(?:startId|start-id|sid)=(\d+)\b/i);
	return sidMatch ? Number(sidMatch[1]) : null;
}

/**
 * Extract engine type and address from message
 */
function extractTypeAndAddress(message: string, raw: string) {
	const typeMatch = message.match(/\btype=([A-Z]{2,3})\b/);
	const hostIdMatch = message.match(/\bhostId=([^,\s]+)/) || raw.match(/\bhostId=([^,\s]+)/);
	const hostAndPortMatch = message.match(/hostAndPort=([^,\s]+)/) || raw.match(/hostAndPort=([^,\s]+)/);
	const addressMatch = message.match(/\baddress=([^,\s]+)/);
	const ipPortMatch = message.match(/(\d+\.\d+\.\d+\.\d+:\d+)/);

	const instType = typeMatch ? typeMatch[1] : undefined;

	// Prefer hostId over hostAndPort (hostAndPort can be "<LOCAL SERVER>" which gets truncated)
	// Filter out <LOCAL entirely - don't use it at all
	const hostAndPort = hostAndPortMatch && hostAndPortMatch[1];
	const cleanHostAndPort = hostAndPort && !hostAndPort.startsWith('<LOCAL') ? hostAndPort : undefined;
	const instAddr =
		(hostIdMatch && hostIdMatch[1]) ||
		cleanHostAndPort ||
		(addressMatch && addressMatch[1]) ||
		(ipPortMatch && ipPortMatch[1]) ||
		undefined;

	return { instType, instAddr };
}

/**
 * Capture database state transitions from message
 */
function captureDatabaseState(message: string, raw: string, ts: number, iso: string): boolean {
	// Prefer the "to" (target) state
	const primary = message.match(
		/Updated database from DatabaseInfo\{name=([^,}]+)[\s\S]*?to DatabaseInfo\{[^}]*state=([A-Za-z_]+)/i
	);
	if (primary) {
		const dbName = primary[1] || 'unknown';
		const state = (primary[2] || '').toUpperCase();
		if (state) {
			dbStateEvents.push({ dbName, ts, iso, state, message, raw });
			return true;
		}
	}

	// Fallback: pick the last state= occurrence on the line as the target state
	if (/Updated database/i.test(message)) {
		const allStates = Array.from(message.matchAll(/\bstate=([A-Za-z_]+)\b/gi));
		if (allStates.length > 0) {
			const last = allStates[allStates.length - 1];
			const state = (last && last[1] ? last[1] : '').toUpperCase();
			// Try to get name from the "to" side first, else any name=, else token after phrase
			const nameTo = message.match(/to DatabaseInfo\{[^}]*name=([^,}]+)/i);
			const nameAny = nameTo || message.match(/\bname=([^,}\s]+)/i) || message.match(/Updated database\s+([^\s,]+)/i);
			const dbName = nameAny && nameAny[1] ? nameAny[1] : 'unknown';
			if (state) {
				dbStateEvents.push({ dbName, ts, iso, state, message, raw });
				return true;
			}
		}
	}
	return false;
}

/**
 * Record startId occurrence for instance tracking
 */
function recordStartIdOccurrence(
	message: string,
	process: string,
	sid: number,
	ts: number,
	iso: string,
	raw: string,
	instType?: string,
	instAddr?: string
) {
	// Determine whether this occurrence should be recorded for instance lifecycle
	const isAppliedStart = /\bApplied\s+StartNodes?Command\b/i.test(message);
	const isAppliedRemove = /\bApplied\s+(RemoveNodeCommand|ShutdownNodesCommand|ShutdownNodeCommand)\b/i.test(message);
	const isDomainResponse = /DomainProcessCommandResponse/.test(message);

	// Record only if this is an applied start or an applied remove/shutdown response
	if (isAppliedStart || isAppliedRemove || isDomainResponse) {
		// Prefer address from sidAddressMap if current instAddr is "<LOCAL" or empty
		const effectiveAddr = instAddr && !instAddr.startsWith('<LOCAL') ? instAddr : sidAddressMap[sid] || instAddr;
		startIdOccurrences.push({
			process,
			sid,
			ts,
			iso,
			raw,
			type: instType || sidTypeMap[sid],
			address: effectiveAddr,
			isStart: !!isAppliedStart,
		});
	}
}

/**
 * Parse DomainProcessStateMachine lines from log text
 */
export function parseDomainLines(text: string, fileSource?: string): LogEvent[] {
	const lines = text.split(/\r?\n/);
	const events: LogEvent[] = [];

	const re = /^(\S+)\s+\S+\s+\[([^\]]+)\]\s+DomainProcessStateMachine\s+(.*)$/;
	// Pattern to detect the start of a new log entry (timestamp at beginning)
	const timestampRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+/;

	let currentEntry: { iso: string; bracket: string; message: string; raw: string } | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		// Check if this line starts a new log entry
		const m = line.match(re);
		
		if (m) {
			// Process the previous entry if it exists
			if (currentEntry) {
				const ts = Date.parse(currentEntry.iso);
				if (!Number.isNaN(ts)) {
					const process = currentEntry.bracket.split(':')[0] || currentEntry.bracket || 'unknown';
					const sid = extractSid(currentEntry.message, currentEntry.raw);
					const { instType, instAddr } = extractTypeAndAddress(currentEntry.message, currentEntry.raw);

					const evt: LogEvent = { 
						ts, 
						iso: currentEntry.iso, 
						process, 
						message: currentEntry.message, 
						raw: currentEntry.raw, 
						fileSource, 
						sid 
					};

					// Parse database update diffs for highlighting
					evt.dbDiff = parseDbDiff(currentEntry.message);

					events.push(evt);

					// Capture database state transitions
					captureDatabaseState(currentEntry.message, currentEntry.raw, ts, currentEntry.iso);

					// Track sid occurrences and metadata
					if (sid !== null) {
						// Capture type/address hints for this sid
						if (instType) sidTypeMap[sid] = sidTypeMap[sid] || instType;

						// Only store address if it's good (not <LOCAL) OR if we don't have one yet
						if (instAddr && !instAddr.startsWith('<LOCAL')) {
							sidAddressMap[sid] = sidAddressMap[sid] || instAddr;
						} else if (instAddr && !sidAddressMap[sid]) {
							// Store <LOCAL as fallback only if we have nothing else
							sidAddressMap[sid] = instAddr;
						}

						recordStartIdOccurrence(currentEntry.message, process, sid, ts, currentEntry.iso, currentEntry.raw, instType, instAddr);
					}
				}
			}

			// Start a new entry
			currentEntry = {
				iso: m[1] ?? '',
				bracket: m[2] ?? '',
				message: m[3] ?? '',
				raw: line
			};
		} else if (currentEntry && !timestampRe.test(line)) {
			// This is a continuation line for the current entry
			// Append it to both the raw and message fields
			currentEntry.raw += '\n' + line;
			currentEntry.message += '\n' + line;
		} else if (currentEntry && timestampRe.test(line)) {
			// This line starts with a timestamp but doesn't match DomainProcessStateMachine
			// Process the current entry and don't start a new one
			const ts = Date.parse(currentEntry.iso);
			if (!Number.isNaN(ts)) {
				const process = currentEntry.bracket.split(':')[0] || currentEntry.bracket || 'unknown';
				const sid = extractSid(currentEntry.message, currentEntry.raw);
				const { instType, instAddr } = extractTypeAndAddress(currentEntry.message, currentEntry.raw);

				const evt: LogEvent = { 
					ts, 
					iso: currentEntry.iso, 
					process, 
					message: currentEntry.message, 
					raw: currentEntry.raw, 
					fileSource, 
					sid 
				};

				// Parse database update diffs for highlighting
				evt.dbDiff = parseDbDiff(currentEntry.message);

				events.push(evt);

				// Capture database state transitions
				captureDatabaseState(currentEntry.message, currentEntry.raw, ts, currentEntry.iso);

				// Track sid occurrences and metadata
				if (sid !== null) {
					// Capture type/address hints for this sid
					if (instType) sidTypeMap[sid] = sidTypeMap[sid] || instType;

					// Only store address if it's good (not <LOCAL) OR if we don't have one yet
					if (instAddr && !instAddr.startsWith('<LOCAL')) {
						sidAddressMap[sid] = sidAddressMap[sid] || instAddr;
					} else if (instAddr && !sidAddressMap[sid]) {
						// Store <LOCAL as fallback only if we have nothing else
						sidAddressMap[sid] = instAddr;
					}

					recordStartIdOccurrence(currentEntry.message, process, sid, ts, currentEntry.iso, currentEntry.raw, instType, instAddr);
				}
			}
			
			// Reset current entry since this is a different log type
			currentEntry = null;
		}
	}

	// Process the last entry if it exists
	if (currentEntry) {
		const ts = Date.parse(currentEntry.iso);
		if (!Number.isNaN(ts)) {
			const process = currentEntry.bracket.split(':')[0] || currentEntry.bracket || 'unknown';
			const sid = extractSid(currentEntry.message, currentEntry.raw);
			const { instType, instAddr } = extractTypeAndAddress(currentEntry.message, currentEntry.raw);

			const evt: LogEvent = { 
				ts, 
				iso: currentEntry.iso, 
				process, 
				message: currentEntry.message, 
				raw: currentEntry.raw, 
				fileSource, 
				sid 
			};

			// Parse database update diffs for highlighting
			evt.dbDiff = parseDbDiff(currentEntry.message);

			events.push(evt);

			// Capture database state transitions
			captureDatabaseState(currentEntry.message, currentEntry.raw, ts, currentEntry.iso);

			// Track sid occurrences and metadata
			if (sid !== null) {
				// Capture type/address hints for this sid
				if (instType) sidTypeMap[sid] = sidTypeMap[sid] || instType;

				// Only store address if it's good (not <LOCAL) OR if we don't have one yet
				if (instAddr && !instAddr.startsWith('<LOCAL')) {
					sidAddressMap[sid] = sidAddressMap[sid] || instAddr;
				} else if (instAddr && !sidAddressMap[sid]) {
					// Store <LOCAL as fallback only if we have nothing else
					sidAddressMap[sid] = instAddr;
				}

				recordStartIdOccurrence(currentEntry.message, process, sid, ts, currentEntry.iso, currentEntry.raw, instType, instAddr);
			}
		}
	}

	events.sort((a, b) => a.ts - b.ts);
	return events;
}

/**
 * Parse failure protocol events from log text
 */
export function parseFailureProtocolLines(text: string): FailureProtocolEvent[] {
	const lines = text.split(/\r?\n/);
	const frpEvents: FailureProtocolEvent[] = [];

	// Match lines like: 2025-11-20T12:09:13.432+0000 [47] (sofdb sid:3 node 4) Failure resolution protocol (iteration 1): ...
	// Note: Some logs may not have INFO/WARN level, so make it optional
	const re =
		/^(\S+)\s+(?:\S+\s+)?\[([^\]]+)\]\s+\((\S+)\s+sid:(\d+)\s+node\s+(\d+)\)\s+Failure resolution protocol\s+\(iteration\s+(\d+)\):\s+(.*)$/;

	for (const raw of lines) {
		const m = raw.match(re);
		if (!m) continue;

		const iso = m[1] ?? '';
		const dbName = m[3] ?? 'unknown';
		const sid = Number(m[4] ?? 0);
		const node = Number(m[5] ?? 0);
		const iteration = Number(m[6] ?? 0);
		const message = m[7] ?? '';
		const ts = Date.parse(iso);
		if (Number.isNaN(ts)) continue;

		frpEvents.push({ dbName, sid, node, iteration, ts, iso, message, raw });
	}

	frpEvents.sort((a, b) => a.ts - b.ts);
	return frpEvents;
}

/**
 * Build events grouped by process
 */
export function buildByProcess(events: LogEvent[]): Record<string, LogEvent[]> {
	const byProcess: Record<string, LogEvent[]> = {};
	for (const e of events) {
		const arr = byProcess[e.process] ?? (byProcess[e.process] = []);
		arr.push(e);
	}
	return byProcess;
}
