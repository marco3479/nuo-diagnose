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

type LogEvent = { ts: number; iso: string; process: string; message: string; raw: string };

function parseDomainLines(text: string): LogEvent[] {
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
			const sidMatch = message.match(/\b(?:startId|start-id|sid)=(\d+)\b/i) || raw.match(/\b(?:startId|start-id|sid)=(\d+)\b/i);
			const sid = sidMatch ? Number(sidMatch[1]) : null;
			// try to extract engine type (TE/SM/AP) and an address/host:port when available
			const typeMatch = message.match(/\btype=([A-Z]{2,3})\b/);
			const hostAndPortMatch = message.match(/hostAndPort=([^,\s]+)/);
			const addressMatch = message.match(/\baddress=([^,\s]+)/);
			const ipPortMatch = message.match(/(\d+\.\d+\.\d+\.\d+:\d+)/);
			const instType = typeMatch ? typeMatch[1] : undefined;
			const instAddr = (hostAndPortMatch && hostAndPortMatch[1]) || (addressMatch && addressMatch[1]) || (ipPortMatch && ipPortMatch[1]) || undefined;

		events.push({ ts, iso, process, message, raw });

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
			if (instAddr) sidAddressMap[sid] = sidAddressMap[sid] || instAddr;
			// Determine whether this occurrence should be recorded for instance lifecycle.
			// We only treat "Applied StartNodeCommand" as the authoritative start moment
			// (instead of earlier "Requesting node" lines). We still record occurrences
			// for Remove/Shutdown-related commands so we can capture end/remove events.
			const isAppliedStart = /\bApplied\s+StartNodes?Command\b/i.test(message);
			const isRemoveOrShutdown = /\b(RemoveNodeCommand|ShutdownNodesCommand|ShutdownNodeCommand)\b/i.test(message);
			const isDomainResponse = /DomainProcessCommandResponse/.test(message);
			// record only if this is an applied start or a remove/shutdown event (or similar)
			if (isAppliedStart || isRemoveOrShutdown || /\bApplying\s+RemoveNodeCommand\b/i.test(message) || /\bApplying\s+ShutdownNodesCommand\b/i.test(message) || isDomainResponse && isRemoveOrShutdown) {
				startIdOccurrences.push({ process, sid, ts, iso, raw, type: instType || sidTypeMap[sid], address: instAddr || sidAddressMap[sid], isStart: !!isAppliedStart });
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
		// build instances from startId occurrences: for each (process,sid) get first and last ts
		const instancesMap: Record<string, { process: string; sid: number; start: number; end: number; firstIso?: string; lastIso?: string; type?: string; address?: string }> = {};
		for (const occ of startIdOccurrences) {
			const key = `${occ.process}:${occ.sid}`;
					if (!instancesMap[key]) instancesMap[key] = { process: occ.process, sid: occ.sid, start: occ.ts, end: occ.ts, firstIso: occ.iso, lastIso: occ.iso, type: occ.type, address: occ.address };
					else {
						const cur = instancesMap[key];
						if (occ.ts < cur.start) { cur.start = occ.ts; cur.firstIso = occ.iso; }
						if (occ.ts > cur.end) { cur.end = occ.ts; cur.lastIso = occ.iso; }
						// prefer setting type/address if present
						if (!cur.type && occ.type) cur.type = occ.type;
						if (!cur.address && occ.address) cur.address = occ.address;
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

// Serve static files from ./public and the events endpoint
const PORT = Number(process.env.PORT) || 8080;
console.log(`Starting Bun server on http://localhost:${PORT} — serving ./public and /events.json`);

Bun.serve({
	port: PORT,
	fetch(req: any) {
		const url = new URL(req.url);
		// events endpoint
		if (url.pathname === "/events.json") return handleEvents(req);

		// default to serving static files from ./public
		// map / -> /public/index.html
		let pathname = url.pathname;
		if (pathname === "/") pathname = "/index.html";
		try {
			const filePath = `public${pathname}`;
			// Bun.file will throw if file doesn't exist
			const file = Bun.file(filePath);
			const mime = lookupMime(filePath) || "application/octet-stream";
			return new Response(file.stream(), { headers: { "Content-Type": mime } });
		} catch (e) {
			return new Response("Not Found", { status: 404 });
		}
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
