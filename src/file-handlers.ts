// File system handlers for diagnose package navigation

declare const Bun: any;

import type { ServerTimeRange } from './types';
import { parseShowDatabase, type DomainState } from './domain-state-parser';

const DASSAULT_PATH = '/support/tickets/dassault';

/**
 * List ZD ticket directories
 */
export async function handleListTickets(request: any): Promise<Response> {
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
		return new Response(JSON.stringify({ tickets }), { headers: { 'Content-Type': 'application/json' } });
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * List diagnose packages in a ZD ticket
 */
export async function handleListDiagnosePackages(request: any): Promise<Response> {
	const url = new URL(request.url);
	const ticket = url.searchParams.get('ticket');
	if (!ticket)
		return new Response(JSON.stringify({ error: 'Missing ticket parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});

	const ticketPath = `${DASSAULT_PATH}/${ticket}`;
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
		return new Response(JSON.stringify({ packages }), { headers: { 'Content-Type': 'application/json' } });
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * List servers in a diagnose package
 */
export async function handleListServers(request: any): Promise<Response> {
	const url = new URL(request.url);
	const ticket = url.searchParams.get('ticket');
	const pkg = url.searchParams.get('package');
	if (!ticket || !pkg)
		return new Response(JSON.stringify({ error: 'Missing ticket or package parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});

	const adminPath = `${DASSAULT_PATH}/${ticket}/${pkg}/admin`;
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
		return new Response(JSON.stringify({ servers }), { headers: { 'Content-Type': 'application/json' } });
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Get server time ranges for timeline visualization
 */
export async function handleServerTimeRanges(request: any): Promise<Response> {
	const url = new URL(request.url);
	const ticket = url.searchParams.get('ticket');
	const pkg = url.searchParams.get('package');
	console.log(`[server-time-ranges] Request for ticket=${ticket}, package=${pkg}`);
	if (!ticket || !pkg)
		return new Response(JSON.stringify({ error: 'Missing ticket or package parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});

	const adminPath = `${DASSAULT_PATH}/${ticket}/${pkg}/admin`;
	console.log(`[server-time-ranges] Reading from: ${adminPath}`);
	try {
		const fs = await import('fs/promises');
		const path = await import('path');
		const entries = await fs.readdir(adminPath);
		console.log(`[server-time-ranges] Found ${entries.length} entries`);

		const serverRanges: ServerTimeRange[] = [];

		for (const entry of entries) {
			try {
				const fullPath = path.join(adminPath, entry);
				const stat = await fs.stat(fullPath);
				if (!stat.isDirectory()) continue;

				const serverPath = fullPath;
				// Find all nuoadmin.log* files
				const files = await Array.fromAsync(new Bun.Glob('nuoadmin.log*').scan({ cwd: serverPath, onlyFiles: true }));
				if (files.length === 0) continue;

				// Sort files: nuoadmin.log, then .1, .2, etc. (highest number = oldest)
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
				const firstTimestampLine = oldestLines.find((line) => /^\d{4}-\d{2}-\d{2}/.test(line));
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
				const lines = newestContent.split(/\r?\n/).filter((l) => l.trim());
				// Find last line that looks like an ISO timestamp
				const lastTimestampLine = [...lines].reverse().find((line) => /^\d{4}-\d{2}-\d{2}/.test(line));
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
		return new Response(JSON.stringify({ serverRanges }), { headers: { 'Content-Type': 'application/json' } });
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		console.error(`[server-time-ranges] Error:`, err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Get all domain state snapshots from show-database.txt files in admin directory
 */
export async function handleDomainStates(request: any): Promise<Response> {
	const url = new URL(request.url);
	const ticket = url.searchParams.get('ticket');
	const pkg = url.searchParams.get('package');
	console.log(`[domain-states] Request for ticket=${ticket}, package=${pkg}`);
	
	if (!ticket || !pkg) {
		return new Response(JSON.stringify({ error: 'Missing ticket or package parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const adminPath = `${DASSAULT_PATH}/${ticket}/${pkg}/admin`;
	console.log(`[domain-states] Reading from: ${adminPath}`);
	
	try {
		const fs = await import('fs/promises');
		const path = await import('path');
		const entries = await fs.readdir(adminPath);
		console.log(`[domain-states] Found ${entries.length} entries`);

		const domainStates: Array<{ timestamp: number; iso: string; state: DomainState }> = [];

		for (const entry of entries) {
			try {
				const fullPath = path.join(adminPath, entry);
				const stat = await fs.stat(fullPath);
				if (!stat.isDirectory()) continue;

				// Try both show-domain.txt and show-database.txt
				let showDbPath = path.join(fullPath, 'show-domain.txt');
				let showDbExists = false;
				
				try {
					await fs.access(showDbPath);
					showDbExists = true;
				} catch (e) {
					// Try show-database.txt as fallback
					showDbPath = path.join(fullPath, 'show-database.txt');
					try {
						await fs.access(showDbPath);
						showDbExists = true;
					} catch (e2) {
						// Neither file exists, skip
					}
				}
				
				if (showDbExists) {
					try {
						const showDbContent = await fs.readFile(showDbPath, 'utf8');
						const domainState = parseShowDatabase(showDbContent);
						
						// Extract timestamp from server time if available
						if (domainState.serverTime) {
							const timestamp = Date.parse(domainState.serverTime);
							if (!isNaN(timestamp)) {
								domainStates.push({
									timestamp,
									iso: domainState.serverTime,
									state: domainState,
								});
								console.log(`[domain-states] Added state from ${entry}: ${domainState.serverTime}`);
							}
						}
					} catch (e) {
						console.error(`[domain-states] Error parsing ${entry}:`, e);
					}
				}
			} catch (e) {
				console.error(`[domain-states] Error processing ${entry}:`, e);
			}
		}

		// Sort by timestamp
		domainStates.sort((a, b) => a.timestamp - b.timestamp);
		console.log(`[domain-states] Returning ${domainStates.length} domain states`);
		
		return new Response(JSON.stringify({ domainStates }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		console.error(`[domain-states] Error:`, err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * List all files in a server directory
 */
export async function handleListFiles(request: any): Promise<Response> {
	const url = new URL(request.url);
	const ticket = url.searchParams.get('ticket');
	const pkg = url.searchParams.get('package');
	const server = url.searchParams.get('server');
	
	console.log(`[list-files] Request for ticket=${ticket}, package=${pkg}, server=${server}`);
	
	if (!ticket || !pkg || !server) {
		return new Response(JSON.stringify({ error: 'Missing ticket, package, or server parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const serverPath = `${DASSAULT_PATH}/${ticket}/${pkg}/admin/${server}`;
	console.log(`[list-files] Reading from: ${serverPath}`);
	
	try {
		const fs = await import('fs/promises');
		const entries = await fs.readdir(serverPath);
		console.log(`[list-files] Found ${entries.length} entries`);
		
		// Filter for files only (not directories)
		const files: string[] = [];
		for (const entry of entries) {
			try {
				const path = await import('path');
				const fullPath = path.join(serverPath, entry);
				const stat = await fs.stat(fullPath);
				if (stat.isFile()) {
					files.push(entry);
				}
			} catch (e) {
				// Skip entries that can't be stat'd
			}
		}
		
		files.sort();
		console.log(`[list-files] Returning ${files.length} files:`, files);
		return new Response(JSON.stringify({ files }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		console.error(`[list-files] Error:`, err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Get content of a specific file
 */
export async function handleFileContent(request: any): Promise<Response> {
	const url = new URL(request.url);
	const ticket = url.searchParams.get('ticket');
	const pkg = url.searchParams.get('package');
	const server = url.searchParams.get('server');
	const file = url.searchParams.get('file');
	
	console.log(`[file-content] Request for ticket=${ticket}, package=${pkg}, server=${server}, file=${file}`);
	
	if (!ticket || !pkg || !server || !file) {
		return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const path = await import('path');
	const serverPath = `${DASSAULT_PATH}/${ticket}/${pkg}/admin/${server}`;
	const filePath = path.join(serverPath, file);
	
	console.log(`[file-content] Reading file: ${filePath}`);
	
	// Security check: ensure the resolved path is within the server directory
	const fs = await import('fs/promises');
	try {
		const realServerPath = await fs.realpath(serverPath);
		const realFilePath = await fs.realpath(filePath).catch(() => null);
		
		if (!realFilePath || !realFilePath.startsWith(realServerPath)) {
			console.error(`[file-content] Security violation: ${realFilePath} not under ${realServerPath}`);
			return new Response('Forbidden', { status: 403 });
		}
		
		const content = await fs.readFile(filePath, 'utf-8');
		console.log(`[file-content] Successfully read ${content.length} bytes`);
		return new Response(content, {
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		});
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		console.error(`[file-content] Error:`, err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * List all files in a server directory
 */
export async function handleListFiles(request: any): Promise<Response> {
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

	const serverPath = `${DASSAULT_PATH}/${ticket}/${pkg}/admin/${server}`;
	
	try {
		const fs = await import('fs/promises');
		const entries = await fs.readdir(serverPath);
		
		// Filter for files only (not directories)
		const files: string[] = [];
		for (const entry of entries) {
			try {
				const path = await import('path');
				const fullPath = path.join(serverPath, entry);
				const stat = await fs.stat(fullPath);
				if (stat.isFile()) {
					files.push(entry);
				}
			} catch (e) {
				// Skip entries that can't be stat'd
			}
		}
		
		files.sort();
		return new Response(JSON.stringify({ files }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Get content of a specific file
 */
export async function handleFileContent(request: any): Promise<Response> {
	const url = new URL(request.url);
	const ticket = url.searchParams.get('ticket');
	const pkg = url.searchParams.get('package');
	const server = url.searchParams.get('server');
	const file = url.searchParams.get('file');
	
	if (!ticket || !pkg || !server || !file) {
		return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const path = await import('path');
	const serverPath = `${DASSAULT_PATH}/${ticket}/${pkg}/admin/${server}`;
	const filePath = path.join(serverPath, file);
	
	// Security check: ensure the resolved path is within the server directory
	const fs = await import('fs/promises');
	const realServerPath = await fs.realpath(serverPath);
	const realFilePath = await fs.realpath(filePath).catch(() => null);
	
	if (!realFilePath || !realFilePath.startsWith(realServerPath)) {
		return new Response('Forbidden', { status: 403 });
	}
	
	try {
		const content = await fs.readFile(filePath, 'utf-8');
		return new Response(content, {
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		});
	} catch (err) {
		const msg = err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err);
		return new Response(JSON.stringify({ error: msg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
