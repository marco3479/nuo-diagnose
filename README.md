# nuo-diagnose (Bun project)

Small tool and UI to parse NuoAdmin logs and display a domain timeline.

Files of interest
- `nuoadmin-diagnose.ts` — Bun HTTP server: serves `public/` and exposes `GET /events.json?path=<log>` which returns parsed `DomainProcessStateMachine` events, process instances, and database state transitions as JSON.
- `tests/mock/nuoadmin.log` — example log used for testing.
- `tests/mock/db_state.log` — sample log with database state transitions.
- `src_ui/app.tsx` — TSX React UI source for the stacked timeline view with filters, sorting, and database state visualization (compiled to `public/app.js`).
- `public/` — static UI files served by the server (`index.html`, `app.js`, `styles.css`).

Prerequisites

- Bun (tested with Bun v1.x). Verify with:

  ```bash
  bun -v
  ```

Quick start (development)

1. Install deps (optional, no deps by default):

   ```bash
   bun install
   ```

2. Start the server (serves static UI and `/events.json`):

   ```bash
   bun ./nuoadmin-diagnose.ts
   ```

   By default the server listens on `http://localhost:8080`. You can override the port with `PORT` environment variable, for example:

   ```bash
   PORT=3002 bun ./nuoadmin-diagnose.ts
   ```

3. Open the UI in a browser:

   - `http://localhost:8080/` — Stacked timeline UI with process instances grouped by address, database state visualization, filters, sorting, and event side-panel
   - `http://localhost:8080/events.json?path=tests/mock/nuoadmin.log` — raw parsed JSON

   Build & Run (production / bundle)

   - Build the UI bundle (produces `public/app.js` and sourcemap):

      ```bash
      bun run build
      ```

   - Start the server (serves files from `public/`):

      ```bash
      bun run start
      ```

   - Verify the endpoint and UI:

      ```bash
      curl "http://localhost:8080/events.json?path=tests/mock/nuoadmin.log" | jq '. | {events: (.events|length), instances: (.instances|length), dbStates: .dbStates, range: .range}'
      # Open browser: http://localhost:8080/
      ```

   Notes about build output

   - After a successful `bun run build` you should see `public/app.js` (the bundled JS) and its sourcemap. The server serves `public/` directly so the UI will load the bundled file without remote ESM imports.
   - If you edit `src_ui/app.tsx` frequently, use `bun run watch` during development for incremental rebuilds and React Fast Refresh.

How parsing works

- The server scans the specified log file and extracts lines that contain `DomainProcessStateMachine`.
- Each matching line is parsed into an event with `ts` (ms epoch), `iso` (timestamp string), `process` (process id), `message`, and `raw` (original line).
- The parser detects `sid` (startId) tokens and extracts engine type (TE/SM/AP) and address information to build process instances with start/end timestamps.
- Database state transitions are captured from "Updated database … to … state=STATE" patterns, extracting the target state and database name.
- The JSON response includes:
  - `events`: array of all parsed events
  - `byProcess`: events grouped by process
  - `instances`: per-sid process instances with start/end, type, and address
  - `dbStates`: database state segments per database name
  - `range`: overall time range with `start`/`end` timestamps


Rebuilding the UI (if you edit `src_ui/app.tsx`)

- Use Bun's bundler (recommended) to create a browser-ready bundle that inlines dependencies and assets. The repo has these convenience scripts in `package.json`:

   ```json
   {
      "scripts": {
         "build": "bun build src_ui/app.tsx --outdir public --sourcemap=linked --target browser --format esm",
         "watch": "bun build src_ui/app.tsx --outdir public --watch --target browser --format esm --react-fast-refresh"
      }
   }
   ```

- One-off production build:

   ```bash
   bun run build
   ```

- Development incremental build with fast refresh:

   ```bash
   bun run watch
   ```

- After building, `public/` will contain the bundled `app.js` and assets which the server will serve.

Notes about React imports and bundling

- If you use bare imports (`import React from 'react'`) in `src_ui/app.tsx`, the Bun bundler resolves and inlines the packages. If you prefer CDN ESM imports (e.g. `https://esm.sh/...`) that also works for rapid prototyping, but the bundler approach produces a single optimized bundle that avoids runtime network loads.
- You may see bundler warnings about `react-dom/client` exports with certain `react`/`react-dom` combinations. The bundler usually handles resolution; if a warning appears, ensure `react` and `react-dom` versions are compatible (the repo currently lists `react`/`react-dom` in `package.json`).

Why use Bun's bundler vs sucrase

- `sucrase` is a fast transpiler (TypeScript/JSX -> JS) useful for quick dev conversions but it does not bundle or resolve dependencies; compiled output may still contain bare imports that the browser cannot fetch directly.
- Bun's `bun build` bundles code, inlines dependencies, supports assets, sourcemaps, minification, code-splitting, and produces production-ready bundles — recommended for building the UI for deployment.

Testing the endpoint locally

```bash
curl "http://localhost:8080/events.json?path=tests/mock/nuoadmin.log" | jq '.'
```

Troubleshooting

- If you see `ENOENT: no such file or directory` for `public/favicon.ico`, add a placeholder file at `public/favicon.ico` (the server attempts to serve it).
- If the server fails to start because a port is in use, set `PORT` to another number.
- The TSX source uses remote ESM imports (or can be bundled). Ensure the compiled `public/app.js` contains playable imports for the browser (this project compiles to use `https://esm.sh` imports by default).

Next steps you might want

- Add a health endpoint (`/healthz`) for supervisors.
- Add a persistent server runner (systemd/pm2) for long-running use.
- Improve UI: more advanced filters, time-range zoom, export capabilities, or a legend for database states.
- Add event-to-instance matching via connectKey for even more precise side-panel filtering.

License: MIT
