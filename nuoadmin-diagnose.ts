// Bun HTTP server that parses NuoAdmin logs and serves a small React UI.
// - GET /events.json?path=<path>  => parsed events JSON (filters DomainProcessStateMachine lines)
// - static files served from ./public
// Default log path: `tests/mock/nuoadmin.log`

declare const Bun: any;
declare const process: any;

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
		if (url.pathname === "/domain-states") return handleDomainStates(req);
		if (url.pathname === "/load-diagnose") return handleLoadDiagnose(req);
		if (url.pathname === "/list-files") return handleListFiles(req);
		if (url.pathname === "/file-content") return handleFileContent(req);

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
