// Bun HTTP server that parses NuoAdmin logs and serves a small React UI.
// - GET /events.json?path=<path>  => parsed events JSON (filters DomainProcessStateMachine lines)
// - static files served from ./public
// Default log path: `tests/mock/nuoadmin.log`

declare const Bun: any;
declare const process: any;

import { watch } from 'fs';
import { handleEvents, handleLoadDiagnose } from './src/event-handlers';
import {
	handleListTickets,
	handleListDiagnosePackages,
	handleListServers,
	handleServerTimeRanges,
	handleDomainStates,
	handleListFiles,
	handleFileContent,
} from './src/file-handlers';

const DEV_MODE = process.env.DEV_MODE === '1';
const textEncoder = new TextEncoder();
const reloadClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
let reloadVersion = 0;

if (DEV_MODE) {
	watch('public', (_eventType: unknown, filename: unknown) => {
		if (typeof filename !== 'string') return;
		if (filename === 'app.js' || filename === 'styles.css' || filename === 'index.html') {
			broadcastReload();
		}
	});
}

function broadcastReload() {
	reloadVersion += 1;
	const payload = textEncoder.encode(`event: reload\ndata: ${JSON.stringify({ version: reloadVersion })}\n\n`);
	for (const controller of reloadClients) {
		try {
			controller.enqueue(payload);
		} catch {
			reloadClients.delete(controller);
		}
	}
}

function createDevEventsResponse() {
	return new Response(new ReadableStream<Uint8Array>({
		start(controller) {
			reloadClients.add(controller);
			controller.enqueue(textEncoder.encode(`retry: 500\nevent: ready\ndata: ${JSON.stringify({ version: reloadVersion })}\n\n`));
		},
		cancel(controller) {
			reloadClients.delete(controller);
		},
	}), {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			'Connection': 'keep-alive',
		},
	});
}

function injectLiveReload(html: string) {
	if (!DEV_MODE) return html;
	const liveReloadScript = `<script type="module">
		let eventSource;
		let reconnectTimer;
		let latestVersion = 0;

		const scheduleReconnect = () => {
			if (reconnectTimer) return;
			reconnectTimer = window.setTimeout(() => {
				reconnectTimer = undefined;
				connect();
			}, 500);
		};

		const handlePayload = (event) => {
			try {
				const payload = JSON.parse(event.data || '{}');
				if (typeof payload.version === 'number') {
					if (event.type === 'reload' && payload.version > latestVersion) {
						window.location.reload();
						return;
					}
					latestVersion = Math.max(latestVersion, payload.version);
				}
			} catch {
				if (event.type === 'reload') {
					window.location.reload();
				}
			}
		};

		const connect = () => {
			if (eventSource) eventSource.close();
			eventSource = new EventSource('/__dev/events');
			eventSource.addEventListener('ready', handlePayload);
			eventSource.addEventListener('reload', handlePayload);
			eventSource.onerror = () => {
				eventSource.close();
				eventSource = undefined;
				scheduleReconnect();
			};
		};

		connect();
	</script>`;
	return html.includes('/__dev/events') ? html : html.replace('</body>', `${liveReloadScript}\n  </body>`);
}

// Serve static files from ./public and the events endpoint
const PORT = Number(process.env.PORT) || 8080;
console.log(`Starting Bun server on http://localhost:${PORT} — serving ./public and /events.json`);

Bun.serve({
	port: PORT,
	fetch: async (req: any) => {
		const url = new URL(req.url);
		if (DEV_MODE && url.pathname === '/__dev/events') return createDevEventsResponse();
		// events endpoint
		if (url.pathname === "/events.json") return handleEvents(req);
		if (url.pathname === "/list-tickets") return handleListTickets(req);
		if (url.pathname === "/list-diagnose-packages") return handleListDiagnosePackages(req);
		if (url.pathname === "/list-servers") return handleListServers(req);
		if (url.pathname === "/server-time-ranges") return handleServerTimeRanges(req);
		if (url.pathname === "/domain-states") return handleDomainStates(req);
		if (url.pathname === "/load-diagnose") return handleLoadDiagnose(req);
		if (url.pathname === "/list-files") return handleListFiles(req);
		if (url.pathname === "/file-content") return handleFileContent(req);

		// default to serving static files from ./public
		// map /, /tickets, /collection, and their subpaths -> /public/index.html (for SPA routing)
		let pathname = url.pathname;
		if (pathname === "/" || pathname === "/tickets" || pathname.startsWith("/tickets/") || pathname === "/collection" || pathname.startsWith("/collection/")) {
			pathname = "/index.html";
		}
		const filePath = `public${pathname}`;
		const file = Bun.file(filePath);
		
		// Check if file exists before trying to serve it
		if (await file.exists()) {
			const mime = lookupMime(filePath) || "application/octet-stream";
			// Add no-cache headers for CSS and JS in development
			const headers: Record<string, string> = { "Content-Type": mime };
			if (DEV_MODE && (filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js'))) {
				headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
				headers["Pragma"] = "no-cache";
				headers["Expires"] = "0";
			}
			if (DEV_MODE && filePath.endsWith('/index.html')) {
				return new Response(injectLiveReload(await file.text()), { headers });
			}
			return new Response(file.stream(), { headers });
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
