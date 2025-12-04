// Event handlers for log parsing endpoints

declare const Bun: any;

import type { ParsedLogResult } from './types';
import {
	parseDomainLines,
	parseFailureProtocolLines,
	buildByProcess,
	resetParserState,
	startIdOccurrences,
	sidTypeMap,
	sidAddressMap,
	dbStateEvents,
} from './parsers';
import { buildInstances } from './instance-builder';
import { buildDbStates } from './db-state';
import { buildInferredDomainStates } from './domain-state-builder';

const DEFAULT_LOG = 'tests/mock/nuoadmin.log';

/**
 * Handle /events.json endpoint - parse single log file
 */
export async function handleEvents(request: any): Promise<Response> {
	const url = new URL(request.url);
	const path = url.searchParams.get('path') || DEFAULT_LOG;

	try {
		const file = Bun.file(path);
		const text = await file.text();

		// Reset state
		resetParserState();

		// Parse events
		const events = parseDomainLines(text);
		const frpEvents = parseFailureProtocolLines(text);
		const byProcess = buildByProcess(events);

		// Build instances
		const instances = buildInstances(events);

		// Build database states
		const dbStates = buildDbStates(events);

		// Build failure protocol events
		const failureProtocols = frpEvents.map((e) => ({
			dbName: e.dbName,
			sid: e.sid,
			node: e.node,
			iteration: e.iteration,
			ts: e.ts,
			iso: e.iso,
			message: e.message,
			raw: e.raw,
		}));

		const first = events[0];
		const last = events[events.length - 1];

		return new Response(
			JSON.stringify(
				{
					events,
					byProcess,
					instances,
					dbStates,
					failureProtocols,
					range: { start: first?.ts ?? null, end: last?.ts ?? null },
				},
				null,
				2
			),
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Handle /load-diagnose endpoint - parse multiple log files from diagnose package
 */
export async function handleLoadDiagnose(request: any): Promise<Response> {
	const url = new URL(request.url);
	const ticket = url.searchParams.get('ticket');
	const pkg = url.searchParams.get('package');
	const server = url.searchParams.get('server');

	if (!ticket || !pkg || !server) {
		return new Response(JSON.stringify({ error: 'Missing ticket, package, or server parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const serverPath = `/support/tickets/dassault/${ticket}/${pkg}/admin/${server}`;

	try {
		// Find all nuoadmin.log* files
		const files = await Array.fromAsync(new Bun.Glob('nuoadmin.log*').scan({ cwd: serverPath, onlyFiles: true }));

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

		// Reset state
		resetParserState();

		// Parse each file separately to track source
		const allEvents: any[] = [];

		for (const file of reversedFiles) {
			const filePath = `${serverPath}/${file}`;
			const fileContent = await Bun.file(filePath).text();
			const fileEvents = parseDomainLines(fileContent, file);
			allEvents.push(...fileEvents);
		}

		// Re-parse the combined text for failure protocols
		let combinedText = '';
		for (const file of reversedFiles) {
			const filePath = `${serverPath}/${file}`;
			const fileContent = await Bun.file(filePath).text();
			combinedText += `\n${fileContent}`;
		}

		const frpEvents = parseFailureProtocolLines(combinedText);

		// Use the combined events
		const events = allEvents;
		const byProcess = buildByProcess(events);

		// Build instances
		const instances = buildInstances(events);

		// Build database states
		const dbStates = buildDbStates(events);

		// Build failure protocol events
		const failureProtocols = frpEvents.map((e) => ({
			dbName: e.dbName,
			sid: e.sid,
			node: e.node,
			iteration: e.iteration,
			ts: e.ts,
			iso: e.iso,
			message: e.message,
			raw: e.raw,
		}));

		const first = events[0];
		const last = events[events.length - 1];

		// Build inferred domain states
		const inferredDomainStates = buildInferredDomainStates(
			events,
			instances,
			first?.ts ?? 0,
			last?.ts ?? Date.now()
		);

		return new Response(
			JSON.stringify(
				{
					events,
					byProcess,
					instances,
					dbStates,
					failureProtocols,
					inferredDomainStates,
					range: { start: first?.ts ?? null, end: last?.ts ?? null },
					server,
					multiFile: true,
				},
				null,
				2
			),
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
