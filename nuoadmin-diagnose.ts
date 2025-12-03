// Bun HTTP server that parses NuoAdmin logs and serves a small React UI.
// - GET /events.json?path=<path>  => parsed events JSON (filters DomainProcessStateMachine lines)
// - static files served from ./public
// Default log path: `tests/mock/nuoadmin.log`

declare const Bun: any;

declare const process: any;
const DEFAULT_LOG = "tests/mock/nuoadmin.log";

type StartOcc = { process: string; sid: number; ts: number; iso: string; raw: string; type?: string; address?: string; isStart?: boolean };
let startIdOccurrences: StartOcc[] = [];
// Track best-known attributes per sid discovered anywhere in the log
const sidTypeMap: Record<number, string> = {};
const sidAddressMap: Record<number, string> = {};
type DbStateEvent = { dbName: string; ts: number; iso: string; state: string; message: string; raw: string };
let dbStateEvents: DbStateEvent[] = [];
type FailureProtocolEvent = { dbName: string; sid: number; node: number; iteration: number; ts: number; iso: string; message: string; raw: string };
let failureProtocolEvents: FailureProtocolEvent[] = [];

type DbDiff = { from: Record<string, any>; to: Record<string, any> };
type LogEvent = { ts: number; iso: string; process: string; message: string; raw: string; fileSource?: string; sid?: number | null; dbDiff?: DbDiff };

function parseDomainLines(text: string, fileSource?: string): LogEvent[] {
	const lines = text.split(/\r?\n/);
	const events: LogEvent[] = [];

	const re = /^(\S+)\s+\S+\s+\[([^\]]+)\]\s+DomainProcessStateMachine\s+(.*)$/;

	for (const raw of lines) {
		const m = raw.match(re);
		if (!m) continue;
		const iso = m[1] ?? "";
		const bracket = m[2] ?? "";
		const message = m[3] ?? "";
		const ts = Date.parse(iso);
		if (Number.isNaN(ts)) continue;
		const process = bracket.split(":")[0] || bracket || "unknown";
		// detect startId/sid/start-id tokens in the message
		// For commands being applied (RemoveNodeCommand, etc.), use the first startId BEFORE "reason=" 
		// since that's the target. The startId in the reason parameter is secondary.
		let sid: number | null = null;
		const reasonIndex = message.indexOf('reason=');
		if (reasonIndex > 0) {
			// Extract startId before the reason parameter
			const beforeReason = message.substring(0, reasonIndex);
			const sidMatch = beforeReason.match(/\b(?:startId|start-id|sid)=(\d+)\b/i);
			sid = sidMatch ? Number(sidMatch[1]) : null;
		}
		// If no startId found before reason, or no reason param, check the full message
		if (sid === null) {
			const sidMatch = message.match(/\b(?:startId|start-id|sid)=(\d+)\b/i) || raw.match(/\b(?:startId|start-id|sid)=(\d+)\b/i);
			sid = sidMatch ? Number(sidMatch[1]) : null;
		}
		// try to extract engine type (TE/SM/AP) and an address/host:port when available
		const typeMatch = message.match(/\btype=([A-Z]{2,3})\b/);
		const hostIdMatch = message.match(/\bhostId=([^,\s]+)/) || raw.match(/\bhostId=([^,\s]+)/);
		const hostAndPortMatch = message.match(/hostAndPort=([^,\s]+)/) || raw.match(/hostAndPort=([^,\s]+)/);
		const addressMatch = message.match(/\baddress=([^,\s]+)/);
		const ipPortMatch = message.match(/(\d+\.\d+\.\d+\.\d+:\d+)/);
		const instType = typeMatch ? typeMatch[1] : undefined;
		// Prefer hostId over hostAndPort (hostAndPort can be "<LOCAL SERVER>" which gets truncated to "<LOCAL")
		// Filter out <LOCAL entirely - don't use it at all
		const hostAndPort = hostAndPortMatch && hostAndPortMatch[1];
		const cleanHostAndPort = (hostAndPort && !hostAndPort.startsWith('<LOCAL')) ? hostAndPort : undefined;
		const instAddr = (hostIdMatch && hostIdMatch[1]) || cleanHostAndPort || (addressMatch && addressMatch[1]) || (ipPortMatch && ipPortMatch[1]) || undefined;

		const evt: LogEvent = { ts, iso, process, message, raw, fileSource, sid };
		
		// Parse database update diffs for highlighting
		if (/Updated database from DatabaseInfo\{/.test(message)) {
			// Extract DatabaseInfo content by counting braces
			const extractDbInfo = (text: string, marker: string) => {
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
			};
			
			const fromContent = extractDbInfo(message, 'from DatabaseInfo{');
			const toContent = extractDbInfo(message, 'to DatabaseInfo{');
			
			if (fromContent && toContent) {
				const parseDbInfo = (str: string) => {
					const obj: Record<string, any> = {};
					// Parse key=value pairs, handling nested braces
					let i = 0;
					while (i < str.length) {
						// Skip whitespace
						while (i < str.length && /\s/.test(str[i])) i++;
						if (i >= str.length) break;
						
						// Find next key (letters, numbers, hyphens)
						const eqIdx = str.indexOf('=', i);
						if (eqIdx === -1) break;
						
						const key = str.substring(i, eqIdx).trim();
						if (!key) { i = eqIdx + 1; continue; }
						
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
				};
				evt.dbDiff = { from: parseDbInfo(fromContent), to: parseDbInfo(toContent) };
			}
		}
		
		events.push(evt);

		// Capture database state transitions
		// Prefer the "to" (target) state. We attempt a primary pattern that spans the line,
		// and fall back to using the last occurrence of state=... if needed.
		let capturedDb = false;
		{
			const primary = message.match(/Updated database from DatabaseInfo\{name=([^,}]+)[\s\S]*?to DatabaseInfo\{[^}]*state=([A-Za-z_]+)/i);
			if (primary) {
				const dbName = primary[1] || 'unknown';
				const state = (primary[2] || '').toUpperCase();
				if (state) { dbStateEvents.push({ dbName, ts, iso, state, message, raw }); capturedDb = true; }
			}
		}
		if (!capturedDb && /Updated database/i.test(message)) {
			// Fallback: pick the last state= occurrence on the line as the target state
			const allStates = Array.from(message.matchAll(/\bstate=([A-Za-z_]+)\b/ig));
			if (allStates.length > 0) {
				const last = allStates[allStates.length - 1];
				const state = (last && last[1] ? last[1] : '').toUpperCase();
				// Try to get name from the "to" side first, else any name=, else token after phrase
				const nameTo = message.match(/to DatabaseInfo\{[^}]*name=([^,}]+)/i);
				const nameAny = nameTo || message.match(/\bname=([^,}\s]+)/i) || message.match(/Updated database\s+([^\s,]+)/i);
				const dbName = nameAny && nameAny[1] ? nameAny[1] : 'unknown';
				if (state) { dbStateEvents.push({ dbName, ts, iso, state, message, raw }); capturedDb = true; }
			}
		}
		// attach sid to the raw line via a side-channel map for later instance building
		if (sid !== null) {
			// capture type/address hints for this sid whenever present (without affecting lifecycle timing)
			if (instType) sidTypeMap[sid] = sidTypeMap[sid] || instType;
			// Only store address if it's good (not <LOCAL) OR if we don't have one yet
			if (instAddr && !instAddr.startsWith('<LOCAL')) {
				sidAddressMap[sid] = sidAddressMap[sid] || instAddr;
			} else if (instAddr && !sidAddressMap[sid]) {
				// Store <LOCAL as fallback only if we have nothing else
				sidAddressMap[sid] = instAddr;
			}
			// Determine whether this occurrence should be recorded for instance lifecycle.
			// We only treat "Applied StartNodeCommand" as the authoritative start moment
			// (instead of earlier "Requesting node" lines). We still record occurrences
			// for Remove/Shutdown-related commands so we can capture end/remove events.
			const isAppliedStart = /\bApplied\s+StartNodes?Command\b/i.test(message);
			// For RemoveNode/Shutdown commands, only record if it's the RESPONSE (Applied/DomainProcessCommandResponse)
			// not the command application itself, to avoid recording admin's action on other processes
			const isAppliedRemove = /\bApplied\s+(RemoveNodeCommand|ShutdownNodesCommand|ShutdownNodeCommand)\b/i.test(message);
			const isDomainResponse = /DomainProcessCommandResponse/.test(message);
			// record only if this is an applied start or an applied remove/shutdown response
			if (isAppliedStart || isAppliedRemove || isDomainResponse) {
				// Prefer address from sidAddressMap if current instAddr is "<LOCAL" or empty
				const effectiveAddr = (instAddr && !instAddr.startsWith('<LOCAL')) ? instAddr : (sidAddressMap[sid] || instAddr);
				startIdOccurrences.push({ process, sid, ts, iso, raw, type: instType || sidTypeMap[sid], address: effectiveAddr, isStart: !!isAppliedStart });
			}
		}
	}

	events.sort((a, b) => a.ts - b.ts);
	return events;
}

function buildByProcess(events: LogEvent[]) {
	const byProcess: Record<string, LogEvent[]> = {};
	for (const e of events) {
		const arr = byProcess[e.process] ?? (byProcess[e.process] = []);
		arr.push(e);
	}
	return byProcess;
}

function parseFailureProtocolLines(text: string): FailureProtocolEvent[] {
	const lines = text.split(/\r?\n/);
	const frpEvents: FailureProtocolEvent[] = [];
	// Match lines like: 2025-11-20T12:09:13.432+0000 [47] (sofdb sid:3 node 4) Failure resolution protocol (iteration 1): ...
	// Note: Some logs may not have INFO/WARN level, so make it optional
	const re = /^(\S+)\s+(?:\S+\s+)?\[([^\]]+)\]\s+\((\S+)\s+sid:(\d+)\s+node\s+(\d+)\)\s+Failure resolution protocol\s+\(iteration\s+(\d+)\):\s+(.*)$/;
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

async function handleEvents(request: any) {
	const url = new URL(request.url);
	const path = url.searchParams.get("path") || DEFAULT_LOG;
	try {
		const file = Bun.file(path);
		const text = await file.text();
		// reset occurrence buffer
		startIdOccurrences = [];
		// reset hint maps per request
		for (const k of Object.keys(sidTypeMap)) delete (sidTypeMap as any)[k];
		for (const k of Object.keys(sidAddressMap)) delete (sidAddressMap as any)[k];
		dbStateEvents = [];
		failureProtocolEvents = [];
		const events = parseDomainLines(text);
		const frpEvents = parseFailureProtocolLines(text);
		const byProcess = buildByProcess(events);
		// Build map of which sids have an authoritative start
		const sidHasStart: Record<number, boolean> = {};
		for (const occ of startIdOccurrences) {
			if (occ.isStart) sidHasStart[occ.sid] = true;
		}
		// build instances from startId occurrences: group by sid only (not by logging process)
		const instancesMap: Record<string, { process: string; sid: number; start: number; end: number; firstIso?: string; lastIso?: string; type?: string; address?: string }> = {};
		for (const occ of startIdOccurrences) {
			const key = `${occ.sid}`;
					if (!instancesMap[key]) instancesMap[key] = { process: occ.process, sid: occ.sid, start: occ.ts, end: occ.ts, firstIso: occ.iso, lastIso: occ.iso, type: occ.type, address: occ.address };
					else {
						const cur = instancesMap[key];
						if (occ.ts < cur.start) { cur.start = occ.ts; cur.firstIso = occ.iso; }
						if (occ.ts > cur.end) { cur.end = occ.ts; cur.lastIso = occ.iso; }
						// prefer setting type/address if present
						if (!cur.type && occ.type) cur.type = occ.type;
						// Prefer non-<LOCAL addresses over existing ones
						if (occ.address && (!cur.address || (cur.address.startsWith('<LOCAL') && !occ.address.startsWith('<LOCAL')))) {
							cur.address = occ.address;
						}
					}
		}
		const first = events[0];
		const last = events[events.length - 1];
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
					if (!i.type && sidTypeMap[i.sid] ) i.type = sidTypeMap[i.sid];
					if (!i.address && sidAddressMap[i.sid]) i.address = sidAddressMap[i.sid];
				}
				const instances = Object.values(instancesMap).map(i => ({ process: i.process, sid: i.sid, start: i.start, end: i.end, firstIso: i.firstIso, lastIso: i.lastIso, type: i.type, address: i.address }));
		// Build DB state segments per database name
		const dbStates: Record<string, Array<{ state: string; start: number; end: number; iso: string; message: string }>> = {};
		const byDb: Record<string, DbStateEvent[]> = {};
		for (const e of dbStateEvents) {
			(byDb[e.dbName] ||= []).push(e);
		}
		for (const [db, arr] of Object.entries(byDb)) {
			arr.sort((a,b)=>a.ts-b.ts);
			if (!arr.length) { dbStates[db] = []; continue; }
			const segs: Array<{ state: string; start: number; end: number; iso: string; message: string }> = [];
			for (let i=0;i<arr.length;i++) {
				const cur = arr[i]!;
				const next = arr[i+1];
				segs.push({ state: cur.state, start: cur.ts, end: next ? next.ts : (last?.ts ?? (cur.ts+1)), iso: cur.iso, message: cur.message });
			}
			dbStates[db] = segs;
		}
		// Build failure protocol events list (keep them as individual events for timeline rendering)
		const failureProtocols = frpEvents.map(e => ({ dbName: e.dbName, sid: e.sid, node: e.node, iteration: e.iteration, ts: e.ts, iso: e.iso, message: e.message, raw: e.raw }));
		return new Response(JSON.stringify({ events, byProcess, instances, dbStates, failureProtocols, range: { start: first?.ts ?? null, end: last?.ts ?? null } }, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (err) {
		const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
}

// Handler to list ZD ticket directories
async function handleListTickets(request: any) {
	const DASSAULT_PATH = "/support/tickets/dassault";
	try {
		const fs = await import('fs/promises');
		const path = await import('path');
		const entries = await fs.readdir(DASSAULT_PATH);
		
		// Filter for zd* entries and check if they're directories using stat
		const tickets: string[] = [];
		for (const entry of entries) {
			if (entry.startsWith('zd')) {
				try {
					const fullPath = path.join(DASSAULT_PATH, entry);
					const stat = await fs.stat(fullPath);
					if (stat.isDirectory()) {
						tickets.push(entry);
					}
				} catch (e) {
					// Skip entries that can't be stat'd
				}
			}
		}
		
		tickets.sort();
		console.log(`[handleListTickets] Found ${tickets.length} zd directories`);
		return new Response(JSON.stringify({ tickets }), { headers: { "Content-Type": "application/json" } });
	} catch (err) {
		const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
}

// Handler to list diagnose packages in a ZD ticket
async function handleListDiagnosePackages(request: any) {
	const url = new URL(request.url);
	const ticket = url.searchParams.get("ticket");
	if (!ticket) return new Response(JSON.stringify({ error: "Missing ticket parameter" }), { status: 400, headers: { "Content-Type": "application/json" } });
	
	const ticketPath = `/support/tickets/dassault/${ticket}`;
	try {
		const fs = await import('fs/promises');
		const path = await import('path');
		const entries = await fs.readdir(ticketPath);
		
		const packages: string[] = [];
		for (const entry of entries) {
			if (entry.startsWith('diagnose-')) {
				try {
					const fullPath = path.join(ticketPath, entry);
					const stat = await fs.stat(fullPath);
					if (stat.isDirectory()) {
						packages.push(entry);
					}
				} catch (e) {
					// Skip entries that can't be stat'd
				}
			}
		}
		
		packages.sort().reverse(); // newest first
		return new Response(JSON.stringify({ packages }), { headers: { "Content-Type": "application/json" } });
	} catch (err) {
		const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
}

// Handler to list servers in a diagnose package
async function handleListServers(request: any) {
	const url = new URL(request.url);
	const ticket = url.searchParams.get("ticket");
	const pkg = url.searchParams.get("package");
	if (!ticket || !pkg) return new Response(JSON.stringify({ error: "Missing ticket or package parameter" }), { status: 400, headers: { "Content-Type": "application/json" } });
	
	const adminPath = `/support/tickets/dassault/${ticket}/${pkg}/admin`;
	try {
		const fs = await import('fs/promises');
		const path = await import('path');
		const entries = await fs.readdir(adminPath);
		
		const servers: string[] = [];
		for (const entry of entries) {
			try {
				const fullPath = path.join(adminPath, entry);
				const stat = await fs.stat(fullPath);
				if (stat.isDirectory()) {
					servers.push(entry);
				}
			} catch (e) {
				// Skip entries that can't be stat'd
			}
		}
		
		servers.sort();
		return new Response(JSON.stringify({ servers }), { headers: { "Content-Type": "application/json" } });
	} catch (err) {
		const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
}

// Handler to get server time ranges for timeline visualization
async function handleServerTimeRanges(request: any) {
	const url = new URL(request.url);
	const ticket = url.searchParams.get("ticket");
	const pkg = url.searchParams.get("package");
	console.log(`[server-time-ranges] Request for ticket=${ticket}, package=${pkg}`);
	if (!ticket || !pkg) return new Response(JSON.stringify({ error: "Missing ticket or package parameter" }), { status: 400, headers: { "Content-Type": "application/json" } });
	
	const adminPath = `/support/tickets/dassault/${ticket}/${pkg}/admin`;
	console.log(`[server-time-ranges] Reading from: ${adminPath}`);
	try {
		const fs = await import('fs/promises');
		const path = await import('path');
		const entries = await fs.readdir(adminPath);
		console.log(`[server-time-ranges] Found ${entries.length} entries`);
		
		const serverRanges: Array<{server: string, start: number, end: number, startIso: string, endIso: string}> = [];
		
		for (const entry of entries) {
			try {
				const fullPath = path.join(adminPath, entry);
				const stat = await fs.stat(fullPath);
				if (!stat.isDirectory()) continue;
				
				const serverPath = fullPath;
				// Find all nuoadmin.log* files
				const files = await Array.fromAsync(new Bun.Glob("nuoadmin.log*").scan({ cwd: serverPath, onlyFiles: true }));
				if (files.length === 0) continue;
				
				// Read first and last log entries to get time range
				const sortedFiles = (files as string[]).sort((a, b) => {
					if (a === 'nuoadmin.log') return -1;
					if (b === 'nuoadmin.log') return 1;
					const aNum = parseInt(a.replace('nuoadmin.log.', ''));
					const bNum = parseInt(b.replace('nuoadmin.log.', ''));
					return aNum - bNum;
				});
				
				const oldestFile = sortedFiles[sortedFiles.length - 1];
				const newestFile = sortedFiles[0];
				
				// Get first timestamp from oldest file (read only first few lines)
				const oldestPath = path.join(serverPath, oldestFile);
				const oldestHandle = await fs.open(oldestPath, 'r');
				const oldestBuffer = Buffer.alloc(2048);
				await oldestHandle.read(oldestBuffer, 0, 2048, 0);
				await oldestHandle.close();
				const oldestContent = oldestBuffer.toString('utf8');
				const oldestLines = oldestContent.split(/\r?\n/);
				// Find first line that looks like an ISO timestamp (YYYY-MM-DD)
				const firstTimestampLine = oldestLines.find(line => /^\d{4}-\d{2}-\d{2}/.test(line));
				const firstLineMatch = firstTimestampLine ? firstTimestampLine.match(/^(\S+)/) : null;
				const startIso = firstLineMatch ? firstLineMatch[1] : '';
				const start = startIso ? Date.parse(startIso) : 0;
				console.log(`[server-time-ranges] ${entry}: start=${startIso} (${start})`);
				
				// Get last timestamp from newest file (read last few KB)
				const newestPath = path.join(serverPath, newestFile);
				const newestStats = await fs.stat(newestPath);
				const newestHandle = await fs.open(newestPath, 'r');
				const readSize = Math.min(8192, newestStats.size);
				const newestBuffer = Buffer.alloc(readSize);
				await newestHandle.read(newestBuffer, 0, readSize, Math.max(0, newestStats.size - readSize));
				await newestHandle.close();
				const newestContent = newestBuffer.toString('utf8');
				const lines = newestContent.split(/\r?\n/).filter(l => l.trim());
				// Find last line that looks like an ISO timestamp
				const lastTimestampLine = [...lines].reverse().find(line => /^\d{4}-\d{2}-\d{2}/.test(line));
				const lastLineMatch = lastTimestampLine ? lastTimestampLine.match(/^(\S+)/) : null;
				const endIso = lastLineMatch ? lastLineMatch[1] : '';
				const end = endIso ? Date.parse(endIso) : 0;
				console.log(`[server-time-ranges] ${entry}: end=${endIso} (${end})`);
				
				if (start && end && !isNaN(start) && !isNaN(end)) {
					serverRanges.push({ server: entry, start, end, startIso, endIso });
					console.log(`[server-time-ranges] Added ${entry}: ${startIso} → ${endIso}`);
				}
			} catch (e) {
				console.error(`[server-time-ranges] Error reading server ${entry}:`, e);
				// Skip entries that can't be read
			}
		}
		
		serverRanges.sort((a, b) => a.start - b.start);
		console.log(`[server-time-ranges] Returning ${serverRanges.length} server ranges`);
		return new Response(JSON.stringify({ serverRanges }), { headers: { "Content-Type": "application/json" } });
	} catch (err) {
		const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
		console.error(`[server-time-ranges] Error:`, err);
		return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
}

// Handler to load diagnose logs
async function handleLoadDiagnose(request: any) {
	const url = new URL(request.url);
	const ticket = url.searchParams.get("ticket");
	const pkg = url.searchParams.get("package");
	const server = url.searchParams.get("server");
	if (!ticket || !pkg || !server) return new Response(JSON.stringify({ error: "Missing ticket, package, or server parameter" }), { status: 400, headers: { "Content-Type": "application/json" } });
	
	const serverPath = `/support/tickets/dassault/${ticket}/${pkg}/admin/${server}`;
	try {
		// Find all nuoadmin.log* files
		const files = await Array.fromAsync(new Bun.Glob("nuoadmin.log*").scan({ cwd: serverPath, onlyFiles: true }));
		
		// Sort files: nuoadmin.log, then .1, .2, etc. (highest number = oldest)
		const sortedFiles = (files as string[]).sort((a, b) => {
			if (a === 'nuoadmin.log') return -1;
			if (b === 'nuoadmin.log') return 1;
			const aNum = parseInt(a.replace('nuoadmin.log.', ''));
			const bNum = parseInt(b.replace('nuoadmin.log.', ''));
			return aNum - bNum;
		});
		
		// Read all files in order (oldest to newest)
		const reversedFiles = sortedFiles.reverse();
		
		// Parse each file separately to track source
		const allEvents: LogEvent[] = [];
		const fileSourceMap: Record<number, string> = {}; // track which file each event came from
		
		for (const file of reversedFiles) {
			const filePath = `${serverPath}/${file}`;
			const fileContent = await Bun.file(filePath).text();
			const fileEvents = parseDomainLines(fileContent, file);
			// Add file source to each event
			for (const ev of fileEvents) {
				fileSourceMap[allEvents.length] = file;
				allEvents.push(ev);
			}
		}
		
		// Now use the combined events for parsing state
		startIdOccurrences = [];
		for (const k of Object.keys(sidTypeMap)) delete (sidTypeMap as any)[k];
		for (const k of Object.keys(sidAddressMap)) delete (sidAddressMap as any)[k];
		dbStateEvents = [];
		failureProtocolEvents = [];
		
		// Re-parse the combined text for failure protocols (they need full text)
		let combinedText = '';
		for (const file of reversedFiles) {
			const filePath = `${serverPath}/${file}`;
			const fileContent = await Bun.file(filePath).text();
			combinedText += `\n${fileContent}`;
		}
		
		const frpEvents = parseFailureProtocolLines(combinedText);
		
		// Process events for instances (reuse parsed events)
		const events = allEvents;
		
		// Extract sid/db info from events (same logic as parseDomainLines but reusing parsed events)
		for (const e of events) {
			const raw = e.raw;
			const message = e.message;
			
			// detect startId/sid/start-id tokens in the message
			// For commands being applied (RemoveNodeCommand, etc.), use the first startId BEFORE "reason=" 
			// since that's the target. The startId in the reason parameter is secondary.
			let sid: number | null = null;
			const reasonIndex = message.indexOf('reason=');
			if (reasonIndex > 0) {
				// Extract startId before the reason parameter
				const beforeReason = message.substring(0, reasonIndex);
				const sidMatch = beforeReason.match(/\b(?:startId|start-id|sid)=(\d+)\b/i);
				sid = sidMatch ? Number(sidMatch[1]) : null;
			}
			// If no startId found before reason, or no reason param, check the full message
			if (sid === null) {
				const sidMatch = message.match(/\b(?:startId|start-id|sid)=(\d+)\b/i) || raw.match(/\b(?:startId|start-id|sid)=(\d+)\b/i);
				sid = sidMatch ? Number(sidMatch[1]) : null;
			}
			
			// Add sid to the event
			e.sid = sid;
			
			// Parse database update diffs for highlighting
			if (/Updated database from DatabaseInfo\{/.test(message)) {
				// Extract DatabaseInfo content by counting braces
				const extractDbInfo = (text: string, marker: string) => {
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
				};
				
				const fromContent = extractDbInfo(message, 'from DatabaseInfo{');
				const toContent = extractDbInfo(message, 'to DatabaseInfo{');
				
				if (fromContent && toContent) {
					const parseDbInfo = (str: string) => {
						const obj: Record<string, any> = {};
						// Parse key=value pairs, handling nested braces
						let i = 0;
						while (i < str.length) {
							// Skip whitespace
							while (i < str.length && /\s/.test(str[i])) i++;
							if (i >= str.length) break;
							
							// Find next key (letters, numbers, hyphens)
							const eqIdx = str.indexOf('=', i);
							if (eqIdx === -1) break;
							
							const key = str.substring(i, eqIdx).trim();
							if (!key) { i = eqIdx + 1; continue; }
							
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
					};
					e.dbDiff = { from: parseDbInfo(fromContent), to: parseDbInfo(toContent) };
				}
			}
			
			const typeMatch = message.match(/\btype=([A-Z]{2,3})\b/);
			const hostIdMatch = message.match(/\bhostId=([^,\s]+)/) || raw.match(/\bhostId=([^,\s]+)/);
			const hostAndPortMatch = message.match(/hostAndPort=([^,\s]+)/);
			const addressMatch = message.match(/\baddress=([^,\s]+)/);
			const ipPortMatch = message.match(/(\d+\.\d+\.\d+\.\d+:\d+)/);
			const instType = typeMatch ? typeMatch[1] : undefined;
			// Prefer hostId over hostAndPort, and filter out <LOCAL
			const hostAndPort = hostAndPortMatch && hostAndPortMatch[1];
			const cleanHostAndPort = (hostAndPort && !hostAndPort.startsWith('<LOCAL')) ? hostAndPort : undefined;
			const instAddr = (hostIdMatch && hostIdMatch[1]) || cleanHostAndPort || (addressMatch && addressMatch[1]) || (ipPortMatch && ipPortMatch[1]) || undefined;
			
			// Capture database state transitions (same logic as before)
			let capturedDb = false;
			{
				const primary = message.match(/Updated database from DatabaseInfo\{name=([^,}]+)[\s\S]*?to DatabaseInfo\{[^}]*state=([A-Za-z_]+)/i);
				if (primary) {
					const dbName = primary[1] || 'unknown';
					const state = (primary[2] || '').toUpperCase();
					if (state) { dbStateEvents.push({ dbName, ts: e.ts, iso: e.iso, state, message, raw }); capturedDb = true; }
				}
			}
			if (!capturedDb && /Updated database/i.test(message)) {
				const allStates = Array.from(message.matchAll(/\bstate=([A-Za-z_]+)\b/ig));
				if (allStates.length > 0) {
					const last = allStates[allStates.length - 1];
					const state = (last && last[1] ? last[1] : '').toUpperCase();
					const nameTo = message.match(/to DatabaseInfo\{[^}]*name=([^,}]+)/i);
					const nameAny = nameTo || message.match(/\bname=([^,}\s]+)/i) || message.match(/Updated database\s+([^\s,]+)/i);
					const dbName = nameAny && nameAny[1] ? nameAny[1] : 'unknown';
					if (state) { dbStateEvents.push({ dbName, ts: e.ts, iso: e.iso, state, message, raw }); capturedDb = true; }
				}
			}
			
			// attach sid occurrences
			if (sid !== null) {
				if (instType) sidTypeMap[sid] = sidTypeMap[sid] || instType;
				// Only store address if it's good (not <LOCAL) OR if we don't have one yet
				if (instAddr && !instAddr.startsWith('<LOCAL')) {
					sidAddressMap[sid] = sidAddressMap[sid] || instAddr;
				} else if (instAddr && !sidAddressMap[sid]) {
					// Store <LOCAL as fallback only if we have nothing else
					sidAddressMap[sid] = instAddr;
				}
				const isAppliedStart = /\bApplied\s+StartNodes?Command\b/i.test(message);
				// For RemoveNode/Shutdown commands, only record if it's the RESPONSE (Applied/DomainProcessCommandResponse)
				// not the command application itself, to avoid recording admin's action on other processes
				const isAppliedRemove = /\bApplied\s+(RemoveNodeCommand|ShutdownNodesCommand|ShutdownNodeCommand)\b/i.test(message);
				const isDomainResponse = /DomainProcessCommandResponse/.test(message);
				// record only if this is an applied start or an applied remove/shutdown response
				if (isAppliedStart || isAppliedRemove || isDomainResponse) {
					// Prefer address from sidAddressMap if current instAddr is "<LOCAL" or empty
					const effectiveAddr = (instAddr && !instAddr.startsWith('<LOCAL')) ? instAddr : (sidAddressMap[sid] || instAddr);
					startIdOccurrences.push({ process: e.process, sid, ts: e.ts, iso: e.iso, raw, type: instType || sidTypeMap[sid], address: effectiveAddr, isStart: !!isAppliedStart });
				}
			}
		}
		
		const byProcess = buildByProcess(events);
		
		// Build map of which sids have an authoritative start
		const sidHasStart: Record<number, boolean> = {};
		for (const occ of startIdOccurrences) {
			if (occ.isStart) sidHasStart[occ.sid] = true;
		}
		
		// build instances from startId occurrences: group by sid only (not by logging process)
		const instancesMap: Record<string, { process: string; sid: number; start: number; end: number; firstIso?: string; lastIso?: string; type?: string; address?: string }> = {};
		for (const occ of startIdOccurrences) {
			const key = `${occ.sid}`;
			if (!instancesMap[key]) instancesMap[key] = { process: occ.process, sid: occ.sid, start: occ.ts, end: occ.ts, firstIso: occ.iso, lastIso: occ.iso, type: occ.type, address: occ.address };
			else {
				const cur = instancesMap[key];
				if (occ.ts < cur.start) { cur.start = occ.ts; cur.firstIso = occ.iso; }
				if (occ.ts > cur.end) { cur.end = occ.ts; cur.lastIso = occ.iso; }
				if (!cur.type && occ.type) cur.type = occ.type;
				// Prefer non-<LOCAL addresses over existing ones
				if (occ.address && (!cur.address || (cur.address.startsWith('<LOCAL') && !occ.address.startsWith('<LOCAL')))) {
					cur.address = occ.address;
				}
			}
		}
		
		const first = events[0];
		const last = events[events.length - 1];
		
		if (first && events.length > 0) {
			for (const [key, inst] of Object.entries(instancesMap)) {
				const sid = inst.sid;
				if (!sidHasStart[sid]) {
					inst.start = Math.min(inst.start, first.ts);
					inst.firstIso = first.iso;
				}
			}
		}
		
		for (const i of Object.values(instancesMap)) {
			if (!i.type && sidTypeMap[i.sid]) i.type = sidTypeMap[i.sid];
			if (!i.address && sidAddressMap[i.sid]) i.address = sidAddressMap[i.sid];
		}
		
		const instances = Object.values(instancesMap).map(i => ({ process: i.process, sid: i.sid, start: i.start, end: i.end, firstIso: i.firstIso, lastIso: i.lastIso, type: i.type, address: i.address }));
		
		// Build DB state segments
		const dbStates: Record<string, Array<{ state: string; start: number; end: number; iso: string; message: string }>> = {};
		const byDb: Record<string, DbStateEvent[]> = {};
		for (const e of dbStateEvents) {
			(byDb[e.dbName] ||= []).push(e);
		}
		for (const [db, arr] of Object.entries(byDb)) {
			arr.sort((a,b)=>a.ts-b.ts);
			if (!arr.length) { dbStates[db] = []; continue; }
			const segs: Array<{ state: string; start: number; end: number; iso: string; message: string }> = [];
			for (let i=0;i<arr.length;i++) {
				const cur = arr[i]!;
				const next = arr[i+1];
				segs.push({ state: cur.state, start: cur.ts, end: next ? next.ts : (last?.ts ?? (cur.ts+1)), iso: cur.iso, message: cur.message });
			}
			dbStates[db] = segs;
		}
		
		const failureProtocols = frpEvents.map(e => ({ dbName: e.dbName, sid: e.sid, node: e.node, iteration: e.iteration, ts: e.ts, iso: e.iso, message: e.message, raw: e.raw }));
		
		return new Response(JSON.stringify({ 
			events, 
			byProcess, 
			instances, 
			dbStates, 
			failureProtocols, 
			range: { start: first?.ts ?? null, end: last?.ts ?? null },
			server,
			multiFile: true
		}, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (err) {
		const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
}

// Serve static files from ./public and the events endpoint
const PORT = Number(process.env.PORT) || 8080;
console.log(`Starting Bun server on http://localhost:${PORT} — serving ./public and /events.json`);

Bun.serve({
	port: PORT,
	fetch: async (req: any) => {
		const url = new URL(req.url);
		// events endpoint
		if (url.pathname === "/events.json") return handleEvents(req);
		if (url.pathname === "/list-tickets") return handleListTickets(req);
		if (url.pathname === "/list-diagnose-packages") return handleListDiagnosePackages(req);
		if (url.pathname === "/list-servers") return handleListServers(req);
		if (url.pathname === "/server-time-ranges") return handleServerTimeRanges(req);
		if (url.pathname === "/load-diagnose") return handleLoadDiagnose(req);

		// default to serving static files from ./public
		// map /, /nuosupport, and /nuosupport/* -> /public/index.html (for SPA routing)
		let pathname = url.pathname;
		if (pathname === "/" || pathname === "/nuosupport" || pathname.startsWith("/nuosupport/")) {
			pathname = "/index.html";
		}
		const filePath = `public${pathname}`;
		const file = Bun.file(filePath);
		
		// Check if file exists before trying to serve it
		if (await file.exists()) {
			const mime = lookupMime(filePath) || "application/octet-stream";
			return new Response(file.stream(), { headers: { "Content-Type": mime } });
		}
		
		return new Response("Not Found", { status: 404 });
	},
});

function lookupMime(path: string) {
	if (path.endsWith('.html')) return 'text/html; charset=utf-8';
	if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
	if (path.endsWith('.css')) return 'text/css; charset=utf-8';
	if (path.endsWith('.json')) return 'application/json; charset=utf-8';
	if (path.endsWith('.png')) return 'image/png';
	if (path.endsWith('.svg')) return 'image/svg+xml';
	return null;
}
