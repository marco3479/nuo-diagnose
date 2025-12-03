import { useEffect, useState } from 'react';
import type {
  ServerTimeRange,
  Instance,
  DbStates,
  FailureProtocol,
  EventType,
} from './types';

declare const fetch: any;
declare const window: any;

export function useTheme(initialTheme: 'dark' | 'light' = 'dark') {
  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return { theme, setTheme };
}

export function useMousePosition() {
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  return { mousePos, setMousePos };
}

export function useDropdownOutsideClick(
  serverDropdownOpen: boolean,
  sidDropdownOpen: boolean,
  setServerDropdownOpen: (open: boolean) => void,
  setSidDropdownOpen: (open: boolean) => void
) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as any;
      if (
        serverDropdownOpen &&
        target &&
        target.closest &&
        !target.closest('.server-dropdown-container')
      ) {
        setServerDropdownOpen(false);
      }
      if (
        sidDropdownOpen &&
        target &&
        target.closest &&
        !target.closest('.sid-dropdown-container')
      ) {
        setSidDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [serverDropdownOpen, sidDropdownOpen, setServerDropdownOpen, setSidDropdownOpen]);
}

export function useUrlNavigation(loadMode: 'file' | 'nuosupport') {
  useEffect(() => {
    if (loadMode === 'nuosupport' && window.location.pathname === '/') {
      window.history.replaceState({}, '', '/nuosupport');
    }
  }, [loadMode]);
}

type LoadDataResult = {
  instances: Instance[];
  events: EventType[];
  dbStates: DbStates;
  failureProtocols: FailureProtocol[];
  range: { start: number; end: number } | null;
  server?: string;
  error?: string;
};

export async function loadFromFile(path: string): Promise<LoadDataResult> {
  const res = await fetch(`/events.json?path=${encodeURIComponent(path)}`);
  const json = await res.json();
  const instances: Instance[] = (json.instances || []).map((i: any) => ({
    process: i.process,
    sid: i.sid,
    start: i.start,
    end: i.end,
    firstIso: i.firstIso,
    lastIso: i.lastIso,
    type: i.type,
    address: i.address,
  }));

  return {
    instances: instances.sort((a, b) => a.start - b.start),
    events: json.events || [],
    dbStates: json.dbStates || {},
    failureProtocols: json.failureProtocols || [],
    range: json.range || null,
  };
}

export async function loadFromNuoSupport(
  ticket: string,
  packageName: string,
  server: string
): Promise<LoadDataResult> {
  const res = await fetch(
    `/load-diagnose?ticket=${encodeURIComponent(ticket)}&package=${encodeURIComponent(
      packageName
    )}&server=${encodeURIComponent(server)}`
  );
  const json = await res.json();

  if (json.error) {
    return {
      instances: [],
      events: [],
      dbStates: {},
      failureProtocols: [],
      range: null,
      error: json.error,
    };
  }

  const instances: Instance[] = (json.instances || []).map((i: any) => ({
    process: i.process,
    sid: i.sid,
    start: i.start,
    end: i.end,
    firstIso: i.firstIso,
    lastIso: i.lastIso,
    type: i.type,
    address: i.address,
  }));

  return {
    instances: instances.sort((a, b) => a.start - b.start),
    events: json.events || [],
    dbStates: json.dbStates || {},
    failureProtocols: json.failureProtocols || [],
    range: json.range || null,
    server: json.server || server,
  };
}

export function useZdTickets() {
  const [zdTickets, setZdTickets] = useState<string[]>([]);

  useEffect(() => {
    console.log('Fetching ZD tickets...');
    fetch('/list-tickets')
      .then((res: any) => {
        console.log('Tickets response status:', res.status);
        return res.json();
      })
      .then((json: any) => {
        console.log('Tickets data:', json);
        if (json.tickets) {
          console.log(`Found ${json.tickets.length} tickets`);
          setZdTickets(json.tickets);
        } else if (json.error) {
          console.error('Error from server:', json.error);
        }
      })
      .catch((e: any) => console.error('Failed to load tickets:', e));
  }, []);

  return zdTickets;
}

export async function loadDiagnosePackages(ticket: string): Promise<string[]> {
  const res = await fetch(
    `/list-diagnose-packages?ticket=${encodeURIComponent(ticket)}`
  );
  const json = await res.json();
  return json.packages || [];
}

export async function loadServerTimeRanges(
  ticket: string,
  packageName: string
): Promise<ServerTimeRange[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.error('Server time ranges fetch timed out after 30s');
  }, 30000);

  try {
    const res = await fetch(
      `/server-time-ranges?ticket=${encodeURIComponent(
        ticket
      )}&package=${encodeURIComponent(packageName)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    console.log('Server time ranges response status:', res.status);
    const json = await res.json();
    console.log('Server time ranges data:', json);

    if (json.error) {
      console.error('Server time ranges error:', json.error);
      return [];
    }

    if (json.serverRanges) {
      console.log(`Loaded ${json.serverRanges.length} server ranges`);
      return json.serverRanges;
    }

    return [];
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      console.error('Server time ranges fetch was aborted (timeout)');
    } else {
      console.error('Failed to load server time ranges:', e);
    }
    return [];
  }
}
