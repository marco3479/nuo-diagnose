# `nuo-diagnose`

`nuo-diagnose` is a Bun-based log analysis tool for NuoDB diagnose data. It parses `nuoadmin.log` files, derives timeline-friendly domain events, and serves a browser UI for exploring process activity, database state changes, inferred domain state, and related files from a diagnose package.

This repository contains both:

- a small HTTP server that parses logs and exposes JSON endpoints
- a React UI that visualizes the parsed output as timelines and side panels

## What this project is for

Use this project when you want to:

- inspect `nuoadmin.log` activity over time
- group log events into process instances by `sid`
- visualize database state transitions and failure protocol activity
- browse files from a support diagnose package without leaving the UI
- compare server timelines inside a diagnose package
- inspect inferred domain state snapshots derived from logs and `show-domain.txt` / `show-database.txt`

## What newcomers should know first

If you are opening this repository for the first time, start with these files:

- `package.json` — scripts and runtime expectations
- `nuoadmin-diagnose.ts` — Bun server entry point and route wiring
- `src/event-handlers.ts` — log parsing endpoints
- `src/file-handlers.ts` — filesystem-backed endpoints for ticket/package browsing
- `src_ui/app.tsx` — main React application state and UI orchestration

At a high level, the app works like this:

1. The browser UI calls server endpoints.
2. The server reads log files or diagnose-package files from disk.
3. Parsers convert raw log lines into structured events.
4. Builders group events into instances, database state segments, and inferred domain state.
5. The UI renders stacked timelines, filters, panels, and a file viewer.

## Repository layout

### Runtime and entry points

- `nuoadmin-diagnose.ts` — Bun HTTP server, static file serving, API route registration, dev live reload
- `scripts/dev.ts` — local development runner that starts both the UI watcher and server watcher
- `public/` — built browser assets and static files served by the server

### Backend parsing and file access

- `src/parsers.ts` — raw log parsing logic
- `src/instance-builder.ts` — derives process instances from parsed events
- `src/db-state.ts` — converts events into database state segments
- `src/domain-state-builder.ts` — derives inferred domain state from event timelines
- `src/domain-state-parser.ts` — parses `show-domain.txt` / `show-database.txt`
- `src/event-handlers.ts` — handlers for log parsing endpoints
- `src/file-handlers.ts` — handlers for ticket/package/server/file browsing
- `src/types.ts` — backend type definitions

### Frontend UI

- `src_ui/app.tsx` — main application component
- `src_ui/hooks.ts` — data loading and UI hooks
- `src_ui/domainState.ts` — domain-state timeline calculations
- `src_ui/fileSearch.ts` — file and content search helpers
- `src_ui/eventClassifier.ts` — event categorization logic used in the UI
- `src_ui/components/` — reusable timeline, panel, filter, and file viewer components

### Tests and sample data

- `nuoadmin-diagnose.test.ts` — Bun tests for ticket listing behavior
- `tests/mock/` — local sample log fixtures used during development

## Prerequisites

You need:

- `bun` `>= 1.0.0`
- access to the repository files
- optional access to `/support/tickets/dassault` if you want to use the ticket/package workflow

Check Bun:

```bash
bun -v
```

## Installation

Install dependencies:

```bash
bun install
```

The project has a small dependency surface:

- `react`
- `react-dom`
- Bun and TypeScript type packages for development

## Running the project

### Development mode

Start the UI watcher and the Bun server together:

```bash
bun run dev
```

What this does:

- rebuilds `src_ui/app.tsx` into `public/app.js` in watch mode
- restarts the Bun server when backend files change
- enables lightweight browser reload when key files in `public/` change

By default, the server runs on `http://localhost:8080`.

To use a different port:

```bash
PORT=3002 bun run dev
```

### Build the UI bundle

Create the browser bundle without starting the server:

```bash
bun run build
```

### Run only the server

For a server-only workflow:

```bash
bun ./nuoadmin-diagnose.ts
```

Or in watch mode:

```bash
bun run dev:server
```

### Run only the UI watcher

```bash
bun run watch
```

## First-run workflow

Once the server is running, open:

- `http://localhost:8080/`
- `http://localhost:8080/tickets`

For a quick local parsing check, fetch the bundled sample log:

```bash
curl "http://localhost:8080/events.json?path=tests/mock/nuoadmin.log"
```

## Supported data sources

The project supports two main workflows.

### 1. Local log file parsing

You can point the server at a local file path using `GET /events.json?path=...`.

Example:

```bash
curl "http://localhost:8080/events.json?path=tests/mock/nuoadmin.log"
```

This is the easiest way to work locally when you just want to inspect a single log.

### 2. Support ticket / diagnose package browsing

The UI can browse support artifacts rooted at:

```text
/support/tickets/dassault
```

Expected layout:

```text
/support/tickets/dassault/
  zd123456/
    nuoadmin.log
    diagnose-YYYY.../
      admin/
        server-a/
          nuoadmin.log
          nuoadmin.log.1
          show-domain.txt
          show-database.txt
          ...other files...
        server-b/
          ...
```

Supported cases:

- a standalone `nuoadmin.log` directly inside a ticket directory
- a diagnose package containing an `admin/<server>/` tree

## API overview

The Bun server serves both static assets and JSON/text endpoints.

### Core parsing endpoints

| Endpoint | Purpose | Notes |
| --- | --- | --- |
| `GET /events.json?path=<file>` | Parse one log file from disk | Defaults to `tests/mock/nuoadmin.log` |
| `GET /load-diagnose?ticket=<ticket>&package=<pkg>&server=<server>` | Parse all `nuoadmin.log*` files for one server | Special package value `__standalone__` reads `<ticket>/nuoadmin.log` |

### Diagnose package navigation endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /list-tickets` | List available `zd*` ticket directories |
| `GET /list-diagnose-packages?ticket=<ticket>` | List `diagnose-*` packages and detect standalone `nuoadmin.log` |
| `GET /list-servers?ticket=<ticket>&package=<pkg>` | List server directories inside `admin/` |
| `GET /server-time-ranges?ticket=<ticket>&package=<pkg>` | Estimate each server's start/end time window |
| `GET /domain-states?ticket=<ticket>&package=<pkg>` | Parse domain snapshots from `show-domain.txt` or `show-database.txt` |
| `GET /list-files?ticket=<ticket>&package=<pkg>&server=<server>` | List files available for the selected server |
| `GET /file-content?ticket=<ticket>&package=<pkg>&server=<server>&file=<file>` | Return the contents of a selected file |

### Static routes

- `/` and `/tickets` serve the SPA entry page from `public/index.html`
- `public/` assets are served directly by `nuoadmin-diagnose.ts`

## What the parser returns

The main parsing endpoints return structured JSON with fields such as:

- `events` — parsed log events in timestamp order
- `byProcess` — events grouped by process identifier
- `instances` — grouped process instances with `sid`, start, end, type, and address
- `dbStates` — per-database state segments for timeline rendering
- `failureProtocols` — extracted failure protocol activity
- `inferredDomainStates` — derived domain-state snapshots for diagnose-package loads
- `range` — overall parsed time window

Important backend types live in `src/types.ts`.

## UI overview

The UI is a single-page React application bundled into `public/app.js`.

Main capabilities include:

- timeline rendering for process instances, servers, APs, and database state
- range selection and time-point scrubbing
- filtering by process type, server, `sid`, and log level
- event classification and side-panel inspection
- domain-state panel for snapshot inspection over time
- file browser and in-file search for server artifacts

The main UI state lives in `src_ui/app.tsx`, while reusable pieces live under `src_ui/components/`.

## Development workflow

### Useful scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Run server watcher and UI watcher together |
| `bun run dev:server` | Run only the Bun server in watch mode |
| `bun run build` | Build the frontend bundle into `public/` |
| `bun run watch` | Watch and rebuild only the frontend bundle |
| `bun test` | Run Bun tests |

### Recommended local loop

```bash
bun install
bun run dev
```

Then:

- edit backend files in `src/` or `nuoadmin-diagnose.ts`
- edit UI files in `src_ui/`
- refresh the browser if needed; dev mode also injects live reload for key static files

## Architecture notes

### Backend flow

1. Request hits `nuoadmin-diagnose.ts`.
2. Route delegates to `src/event-handlers.ts` or `src/file-handlers.ts`.
3. Parsers in `src/parsers.ts` extract log events from raw text.
4. Builders derive higher-level structures:
   - `src/instance-builder.ts`
   - `src/db-state.ts`
   - `src/domain-state-builder.ts`
5. The server returns JSON to the UI.

### Frontend flow

1. `src_ui/hooks.ts` fetches data from the server.
2. `src_ui/app.tsx` stores global page state and selection state.
3. Timeline and panel components render filtered data.
4. Search helpers in `src_ui/fileSearch.ts` support file and content searching.

## Testing

Run tests with:

```bash
bun test
```

Current test coverage is light and focused on filesystem-backed ticket listing behavior.

Important note:

- `nuoadmin-diagnose.test.ts` expects the `/support/tickets/dassault` directory to exist and contain `zd*` directories
- if that directory is not present on your machine, those tests will fail for environment reasons rather than application logic

## Troubleshooting

### The UI loads, but no ticket data appears

Check whether the server has access to:

```text
/support/tickets/dassault
```

The ticket/package workflow depends on that path.

### The sample log works, but diagnose-package views do not

Confirm that your selected ticket follows the expected directory layout, especially:

- `<ticket>/nuoadmin.log` for standalone mode, or
- `<ticket>/<package>/admin/<server>/nuoadmin.log*` for package mode

### The browser shows stale assets

Rebuild the UI bundle:

```bash
bun run build
```

Or use development mode:

```bash
bun run dev
```

### A server port is already in use

Run on a different port:

```bash
PORT=3002 bun run dev
```

## Current limitations

- The support root is currently hardcoded to `/support/tickets/dassault` in `src/file-handlers.ts`.
- Test coverage is limited and includes environment-specific assumptions.
- The UI contains a `collection` mode scaffold, but the backend route `GET /list-collection` is not implemented in the current server.

## Suggested places to contribute

Good first improvements include:

- making the support root configurable via environment variable
- adding tests around parsing and builder logic using local fixtures
- documenting example response payloads for each endpoint
- expanding the file browser and export workflows
- implementing or removing the unfinished collection-mode path
