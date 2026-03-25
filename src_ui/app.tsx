import React, { useEffect, useState, useRef, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import assert from '../assert';
import type {
  Instance,
  DbStates,
  FailureProtocol,
  ServerTimeRange,
  EventType,
  HoveredBar,
  FocusedTimelineItem,
  TableRow,
  SortKey,
  SortDir,
  DomainStateSnapshot,
} from './types';
import {
  getInstanceType,
  sortInstances,
  groupInstancesByAddress,
  sortAddressesByEarliestStart,
} from './utils';
import {
  clampCurrentTimePoint,
  getAdjacentTimePoint,
  getCurrentDomainStateSnapshot,
  getDomainStateFrame,
  getPreviousDomainStateSnapshot,
  getVisibleDomainStateTimestamps,
  mergeDomainStates,
} from './domainState';
import {
  countMatches,
  countRegexMatches,
  findContentMatches,
  getFilteredFiles,
  type ContentMatch,
  type FileSearchResult,
} from './fileSearch';
import {
  useTheme,
  useMousePosition,
  useDropdownOutsideClick,
  useUrlNavigation,
  useZdTickets,
  loadFromFile,
  loadFromNuoSupport,
  loadCollectionItems,
  loadDiagnosePackages,
  loadServerTimeRanges,
  loadDomainStates,
} from './hooks';
import { classifyEvents } from './eventClassifier';
import {
  Controls,
  ServerTimeline,
  FilterBar,
  FilterControls,
  RangeSlider,
  Tooltip,
  LoadingSpinner,
  DatabaseTimeline,
  UnclassifiedEventsRow,
  ProcessTimeline,
  LogPanel,
  TimePointSlider,
  DomainStatePanel,
  FileViewer,
} from './components';

declare const fetch: any;
declare const document: any;
declare const window: any;

function StackApp(): JSX.Element {
  const [path, setPath] = useState('tests/mock/nuoadmin.log');
  const initialMode = window.location.pathname.startsWith('/collection') ? 'collection' : 'tickets';
  const [loadMode, setLoadMode] = useState<'collection' | 'tickets'>(initialMode);
  const [collectionItems, setCollectionItems] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<string>('');
  const [diagnosePackages, setDiagnosePackages] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [servers, setServers] = useState<string[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [serverTimeRanges, setServerTimeRanges] = useState<ServerTimeRange[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [dbStates, setDbStates] = useState<DbStates>({});
  const [failureProtocols, setFailureProtocols] = useState<FailureProtocol[]>([]);
  const [selectedSid, setSelectedSid] = useState<number | null>(null);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [selectedAp, setSelectedAp] = useState<string | null>(null);
  const [selectedUnclassified, setSelectedUnclassified] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [globalStart, setGlobalStart] = useState<number>(Date.now());
  const [globalEnd, setGlobalEnd] = useState<number>(Date.now() + 1);
  const [loading, setLoading] = useState(false);
  const [loadedServer, setLoadedServer] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterServers, setFilterServers] = useState<Set<string>>(new Set());
  const [filterSids, setFilterSids] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('sid');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'range' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartRange, setDragStartRange] = useState<{start: number, end: number}>({start: 0, end: 0});
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const [focusedEventIndex, setFocusedEventIndex] = useState<number>(-1);
  const [panelFocus, setPanelFocus] = useState<'timeline' | 'table' | 'events'>('timeline');
  const [focusedTimelineItem, setFocusedTimelineItem] = useState<FocusedTimelineItem | null>(null);
  const [hoveredBar, setHoveredBar] = useState<HoveredBar | null>(null);
  const [apsCollapsed, setApsCollapsed] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [sidDropdownOpen, setSidDropdownOpen] = useState(false);
  const [domainStates, setDomainStates] = useState<DomainStateSnapshot[]>([]);
  const [currentTimePoint, setCurrentTimePoint] = useState<number | null>(null);
  const [domainPanelOpen, setDomainPanelOpen] = useState(true);
  const [domainPanelWidth, setDomainPanelWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(60);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const [mainViewMode, setMainViewMode] = useState<'timeline' | 'files'>('timeline');
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileListSearch, setFileListSearch] = useState<string>('');
  const [fileContentSearch, setFileContentSearch] = useState<string>('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [fileSearchResults, setFileSearchResults] = useState<FileSearchResult[]>([]);
  const [isSearchingFiles, setIsSearchingFiles] = useState<boolean>(false);
  const [fileSearchRegex, setFileSearchRegex] = useState<boolean>(false);
  const [fileContentSearchRegex, setFileContentSearchRegex] = useState<boolean>(false);
  const [contentMatches, setContentMatches] = useState<ContentMatch[]>([]);
  const [isCalculatingMatches, setIsCalculatingMatches] = useState<boolean>(false);
  const [logLevelFilter, setLogLevelFilter] = useState<string>('All levels');

  const rangeStartRef = useRef<number | null>(rangeStart);
  const rangeEndRef = useRef<number | null>(rangeEnd);
  const globalStartRef = useRef<number>(globalStart);
  const globalEndRef = useRef<number>(globalEnd);
  const dragStartXRef = useRef<number>(dragStartX);
  const dragStartRangeRef = useRef<{start: number, end: number}>(dragStartRange);

  useEffect(() => { rangeStartRef.current = rangeStart; }, [rangeStart]);
  useEffect(() => { rangeEndRef.current = rangeEnd; }, [rangeEnd]);
  useEffect(() => { globalStartRef.current = globalStart; }, [globalStart]);
  useEffect(() => { globalEndRef.current = globalEnd; }, [globalEnd]);
  useEffect(() => { dragStartXRef.current = dragStartX; }, [dragStartX]);
  useEffect(() => { dragStartRangeRef.current = dragStartRange; }, [dragStartRange]);

  const { theme, setTheme } = useTheme('dark');
  const { mousePos, setMousePos } = useMousePosition();
  const zdTickets = useZdTickets();

  useDropdownOutsideClick(serverDropdownOpen, sidDropdownOpen, setServerDropdownOpen, setSidDropdownOpen);
  useUrlNavigation(loadMode);

  useEffect(() => {
    if (!fileListSearch || fileListSearch.length < 3) {
      setFileSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchAcrossFiles(fileListSearch);
    }, 500);

    return () => clearTimeout(timer);
  }, [fileListSearch, loadMode, selectedTicket, selectedPackage, selectedServer, availableFiles, fileSearchRegex]);

  useEffect(() => {
    if (!fileContentSearch || !fileContent) {
      setContentMatches([]);
      setIsCalculatingMatches(false);
      return;
    }

    setIsCalculatingMatches(true);
    const timer = setTimeout(() => {
      const matches = findContentMatches(fileContent, fileContentSearch, fileContentSearchRegex);
      setContentMatches(matches);
      setCurrentMatchIndex(0);
      setIsCalculatingMatches(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [fileContentSearch, fileContent, fileContentSearchRegex]);

  useEffect(() => {
    if (!isResizingTimeline) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const appElement = document.querySelector('.app');
      if (!appElement) return;
      const rect = appElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const percentage = (relativeY / rect.height) * 100;
      const clampedPercentage = Math.max(30, Math.min(80, percentage));
      setTimelineHeight(clampedPercentage);
    };

    const handleMouseUp = () => {
      setIsResizingTimeline(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingTimeline]);

  useEffect(() => {
    if (!isResizing) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - e.clientX;
      const clampedWidth = Math.max(300, Math.min(800, newWidth));
      setDomainPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  useEffect(() => {
    if (loadMode === 'collection') {
      loadCollectionItems().then(setCollectionItems);
    }
  }, [loadMode]);

  async function load(p = selectedCollection) {
    setLoading(true);
    try {
      const data = await loadFromFile(p);
      setInstances(data.instances);
      setEvents(data.events);
      setDbStates(data.dbStates);
      setFailureProtocols(data.failureProtocols);
      setLoadedServer('');

      if (data.range && data.range.start && data.range.end) {
        setGlobalStart(data.range.start);
        setGlobalEnd(data.range.end);
        setRangeStart(data.range.start);
        setRangeEnd(data.range.end);
      } else if (data.instances.length) {
        const firstInst = data.instances[0]!;
        const lastInst = data.instances[data.instances.length - 1] ?? firstInst;
        setGlobalStart(firstInst.start);
        setGlobalEnd(lastInst.end ?? lastInst.start);
        setRangeStart(firstInst.start);
        setRangeEnd(lastInst.end ?? lastInst.start);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadFileList() {
    if (loadMode === 'tickets' && selectedTicket && selectedPackage && selectedServer) {
      console.log('[loadFileList] Loading files for:', { selectedTicket, selectedPackage, selectedServer });
      try {
        const res = await fetch(
          `/list-files?ticket=${encodeURIComponent(selectedTicket)}&package=${encodeURIComponent(selectedPackage)}&server=${encodeURIComponent(selectedServer)}`
        );
        const json = await res.json();
        console.log('[loadFileList] Response:', json);
        if (json.error) {
          console.error('[loadFileList] Error from server:', json.error);
          setAvailableFiles([]);
        } else if (json.files) {
          console.log('[loadFileList] Setting files:', json.files.length);
          setAvailableFiles(json.files);
        }
      } catch (e) {
        console.error('[loadFileList] Error loading file list:', e);
        setAvailableFiles([]);
      }
    } else {
      console.log('[loadFileList] Conditions not met:', { loadMode, selectedTicket, selectedPackage, selectedServer });
    }
  }

  const filteredFiles = getFilteredFiles(availableFiles, fileListSearch, fileSearchResults);

  async function searchAcrossFiles(searchText: string) {
    if (!searchText || loadMode !== 'tickets' || !selectedTicket || !selectedPackage || !selectedServer) {
      setFileSearchResults([]);
      return;
    }

    setIsSearchingFiles(true);
    const results: FileSearchResult[] = [];

    try {
      for (const file of availableFiles) {
        const res = await fetch(
          `/file-content?ticket=${encodeURIComponent(selectedTicket)}&package=${encodeURIComponent(selectedPackage)}&server=${encodeURIComponent(selectedServer)}&file=${encodeURIComponent(file)}`
        );
        const content = await res.text();
        const matchCount = fileSearchRegex
          ? countRegexMatches(content, searchText)
          : countMatches(content, searchText);

        if (matchCount > 0) {
          results.push({ file, matches: matchCount });
        }
      }
      setFileSearchResults(results);
    } catch (e) {
      console.error('[searchAcrossFiles] Error:', e);
    } finally {
      setIsSearchingFiles(false);
    }
  }

  async function loadFileContent(filename: string) {
    if (loadMode === 'tickets' && selectedTicket && selectedPackage && selectedServer) {
      try {
        const res = await fetch(
          `/file-content?ticket=${encodeURIComponent(selectedTicket)}&package=${encodeURIComponent(selectedPackage)}&server=${encodeURIComponent(selectedServer)}&file=${encodeURIComponent(filename)}`
        );
        const text = await res.text();
        setFileContent(text);
        setSelectedFile(filename);
        setFileContentSearch('');
        setCurrentMatchIndex(0);
      } catch (e) {
        console.error('Error loading file content:', e);
      }
    }
  }

  function goToNextMatch() {
    if (contentMatches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % contentMatches.length);
    }
  }

  function goToPrevMatch() {
    if (contentMatches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + contentMatches.length) % contentMatches.length);
    }
  }

  // Load files when server changes or when switching to files view
  useEffect(() => {
    console.log('[useEffect] Checking if should load files:', { loadMode, selectedServer, mainViewMode, selectedTicket, selectedPackage });
    if (loadMode === 'tickets' && selectedTicket && selectedPackage && selectedServer && mainViewMode === 'files') {
      console.log('[useEffect] Triggering loadFileList');
      loadFileList();
    }
  }, [selectedServer, loadMode, mainViewMode, selectedTicket, selectedPackage]);

  async function loadFromNuoSupportHandler() {
    if (!selectedTicket || !selectedPackage || !selectedServer) return;
    setLoading(true);
    try {
      const data = await loadFromNuoSupport(selectedTicket, selectedPackage, selectedServer);
      
      if (data.error) {
        console.error(data.error);
        alert(`Error: ${data.error}`);
        return;
      }
      
      setInstances(data.instances);
      setEvents(data.events);
      setDbStates(data.dbStates);
      setFailureProtocols(data.failureProtocols);
      setLoadedServer(data.server || selectedServer);
      
      // Merge inferred domain states with loaded reference states
      if (data.inferredDomainStates && data.inferredDomainStates.length > 0) {
        // Merge with already loaded domain states from show-domain.txt
        const mergedStates = mergeDomainStates(domainStates, data.inferredDomainStates);
        setDomainStates(mergedStates);
        
        // Set initial timepoint
        if (mergedStates.length > 0 && mergedStates[0]) {
          setCurrentTimePoint(mergedStates[0].timestamp);
        }
      }
      
      if (data.range && data.range.start && data.range.end) {
        setGlobalStart(data.range.start);
        setGlobalEnd(data.range.end);
        setRangeStart(data.range.start);
        setRangeEnd(data.range.end);
      } else if (data.instances.length) {
        const firstInst = data.instances[0]!;
        const lastInst = data.instances[data.instances.length - 1] ?? firstInst;
        setGlobalStart(firstInst.start);
        setGlobalEnd(lastInst.end ?? lastInst.start);
        setRangeStart(firstInst.start);
        setRangeEnd(lastInst.end ?? lastInst.start);
      }
    } catch (e) {
      console.error(e);
      alert(`Error loading diagnose: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  // Merge reference states from show-domain.txt with inferred states
  // Parse URL parameters like /tickets/zd12345/diagnose-20231201/server01
  useEffect(() => {
    const urlPath = window.location.pathname;
    const fullMatch = urlPath.match(/\/tickets\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    const packageMatch = urlPath.match(/\/tickets\/([^\/]+)\/([^\/]+)$/);
    const ticketMatch = urlPath.match(/\/tickets\/([^\/]+)$/);
    
    if (zdTickets.length > 0) {
      if (fullMatch) {
        const [, ticket, pkg, server] = fullMatch;
        setSelectedTicket(ticket);
        (window as any).__initialPackage = pkg;
        (window as any).__initialServer = server;
      } else if (packageMatch) {
        const [, ticket, pkg] = packageMatch;
        setSelectedTicket(ticket);
        (window as any).__initialPackage = pkg;
      } else if (ticketMatch) {
        const [, ticket] = ticketMatch;
        setSelectedTicket(ticket);
      }
    }
  }, [zdTickets]);

  // Load diagnose packages when ticket selected
  useEffect(() => {
    if (!selectedTicket) {
      setDiagnosePackages([]);
      setSelectedPackage('');
      return;
    }
    
    setSelectedPackage('');
    setSelectedServer('');
    setServers([]);
    setServerTimeRanges([]);
    
    if (loadMode === 'tickets' && !(window as any).__initialPackage) {
      window.history.pushState({}, '', `/tickets/${selectedTicket}`);
    }
    
    loadDiagnosePackages(selectedTicket)
      .then((packages) => {
        setDiagnosePackages(packages);
        const initialPkg = (window as any).__initialPackage;
        if (initialPkg && packages.includes(initialPkg)) {
          setSelectedPackage(initialPkg);
          delete (window as any).__initialPackage;
        } else if (packages.length > 0 && packages[0]) {
          setSelectedPackage(packages[0]);
        }
      })
      .catch((e: any) => console.error('Failed to load packages:', e));
  }, [selectedTicket, loadMode]);

  // Load servers when package selected
  useEffect(() => {
    if (!selectedTicket || !selectedPackage) {
      setServers([]);
      setSelectedServer('');
      setServerTimeRanges([]);
      setDomainStates([]);
      return;
    }
    
    if (!diagnosePackages.includes(selectedPackage)) {
      console.log('Skipping server fetch - package not in current ticket');
      return;
    }
    
    // Handle standalone log - skip server fetching
    if (selectedPackage === '__standalone__') {
      setServers([]);
      setSelectedServer('standalone');
      setServerTimeRanges([]);
      setDomainStates([]);
      return;
    }
    
    if (loadMode === 'tickets' && !(window as any).__initialServer) {
      window.history.pushState({}, '', `/tickets/${selectedTicket}/${selectedPackage}`);
    }
    
    setSelectedServer('');
    setServers([]);
    setServerTimeRanges([]);
    setDomainStates([]);
    setLoading(true);
    
    Promise.all([
      loadServerTimeRanges(selectedTicket, selectedPackage),
      loadDomainStates(selectedTicket, selectedPackage),
    ])
      .then(([serverRanges, domainStateSnapshots]) => {
        setLoading(false);
        setServerTimeRanges(serverRanges);
        setDomainStates(domainStateSnapshots);
        
        // Set initial timepoint to first state if available
        if (domainStateSnapshots.length > 0 && domainStateSnapshots[0]) {
          setCurrentTimePoint(domainStateSnapshots[0].timestamp);
        }
        
        const servers = serverRanges.map((r: ServerTimeRange) => r.server);
        setServers(servers);
        
        const initialServer = (window as any).__initialServer;
        if (initialServer && servers.includes(initialServer)) {
          setSelectedServer(initialServer);
          delete (window as any).__initialServer;
        } else if (servers.length > 0 && servers[0]) {
          setSelectedServer(servers[0]);
        }
      })
      .catch((e: any) => {
        setLoading(false);
        console.error('Server time ranges error:', e);
      });
  }, [selectedTicket, selectedPackage, diagnosePackages, loadMode]);

  // Automatically load when server is selected
  useEffect(() => {
    if (selectedServer && selectedTicket && selectedPackage && loadMode === 'tickets') {
      const newPath = selectedPackage === '__standalone__' 
        ? `/tickets/${selectedTicket}/standalone`
        : `/tickets/${selectedTicket}/${selectedPackage}/${selectedServer}`;
      window.history.pushState({}, '', newPath);
      loadFromNuoSupportHandler();
    }
  }, [selectedServer]);

  const gStart = rangeStart ?? globalStart;
  const gEnd = rangeEnd ?? globalEnd;
  const span = Math.max(1, gEnd - gStart);

  const visibleDomainStates = React.useMemo(() => {
    return domainStates.filter((snapshot) => snapshot.timestamp >= gStart && snapshot.timestamp <= gEnd);
  }, [domainStates, gStart, gEnd]);

  const visibleDomainStateTimestamps = React.useMemo(
    () => getVisibleDomainStateTimestamps(domainStates, gStart, gEnd),
    [domainStates, gStart, gEnd]
  );

  useEffect(() => {
    const nextTimePoint = clampCurrentTimePoint(currentTimePoint, visibleDomainStateTimestamps);
    if (nextTimePoint !== currentTimePoint) {
      setCurrentTimePoint(nextTimePoint);
    }
  }, [currentTimePoint, visibleDomainStateTimestamps]);

  // Domain state navigation functions
  const handleNextState = () => {
    const nextTimePoint = getAdjacentTimePoint(visibleDomainStateTimestamps, currentTimePoint, 'next', gStart);
    if (typeof nextTimePoint === 'number') {
      setCurrentTimePoint(nextTimePoint);
    }
  };

  const handlePrevState = () => {
    const previousTimePoint = getAdjacentTimePoint(visibleDomainStateTimestamps, currentTimePoint, 'prev', gStart);
    if (typeof previousTimePoint === 'number') {
      setCurrentTimePoint(previousTimePoint);
    }
  };

  // Get current domain state based on timepoint - find the most recent state at or before the timepoint
  const currentDomainStateSnapshot = React.useMemo(
    () => getCurrentDomainStateSnapshot(visibleDomainStates, currentTimePoint),
    [currentTimePoint, visibleDomainStates]
  );

  const currentDomainState = currentDomainStateSnapshot?.state || null;

  // Get previous domain state for change detection
  const previousDomainStateSnapshot = React.useMemo(
    () => getPreviousDomainStateSnapshot(visibleDomainStates, currentDomainStateSnapshot),
    [currentDomainStateSnapshot, visibleDomainStates]
  );

  const currentDomainStateFrame = React.useMemo(
    () => getDomainStateFrame(visibleDomainStates, currentDomainStateSnapshot),
    [currentDomainStateSnapshot, visibleDomainStates]
  );

  // visible instances intersecting selection
  const visible = instances.filter(i => {
    const removeEvents = events.filter((e: any) => {
      return e.sid === i.sid && /RemoveNodeCommand/.test(e.message ?? '');
    });
    const effectiveEnd = removeEvents.length > 0 ? i.end : globalEnd;
    return effectiveEnd >= gStart && i.start <= gEnd;
  });

  // Build filter options
  const allRowsBySid: Record<string, Instance[]> = {};
  for (const inst of instances) {
    const key = String(inst.sid);
    (allRowsBySid[key] ||= []).push(inst);
  }
  
  const instanceTypeGetter = (i: Instance): string => getInstanceType(i, allRowsBySid);
  const typeOptions = Array.from(new Set(instances.map(instanceTypeGetter).filter(Boolean))).sort();
  const allServers = Array.from(new Set(instances.map(i => i.address).filter(Boolean) as string[])).sort();
  const allSids = Array.from(new Set(instances.map(i => String(i.sid)))).sort((a, b) => Number(a) - Number(b));
  
  // Apply filters
  const filtered = visible.filter(i => {
    const t = instanceTypeGetter(i);
    if (filterType !== 'ALL' && t !== filterType) return false;
    if (filterServers.size > 0 && !filterServers.has(i.address ?? '')) return false;
    if (filterSids.size > 0 && !filterSids.has(String(i.sid))) return false;
    return true;
  });

  // Group filtered rows by sid
  const rowsBySid: Record<string, Instance[]> = {};
  for (const inst of filtered) {
    const key = String(inst.sid);
    (rowsBySid[key] ||= []).push(inst);
  }

  // Sort instances
  const visibleSorted = sortInstances(filtered, sortKey, sortDir, instanceTypeGetter);

  // Classify events
  const { processEvents, databaseEvents, unclassifiedEvents } = classifyEvents(events, dbStates);
  
  const hasUnclassified = unclassifiedEvents.length > 0;
  const unclassifiedRows: TableRow[] = hasUnclassified
    ? [{ type: 'unclassified', key: 'unclassified' }]
    : [];
  const databaseRows: TableRow[] = Object.keys(dbStates || {}).map((db) => ({
    type: 'db',
    key: db,
  }));
  const instanceRows: TableRow[] = visibleSorted.map((inst, idx) => ({
    type: 'instance',
    key: `inst-${idx}`,
    instance: inst,
  }));
  const allTableRows: TableRow[] = [
    ...unclassifiedRows,
    ...databaseRows,
    ...instanceRows,
  ];

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Group sids by address (for filtered/visible timeline)
  const groupsByAddress = groupInstancesByAddress(rowsBySid);
  const addresses = sortAddressesByEarliestStart(groupsByAddress, rowsBySid);

  // Group all sids by address (for minimap - always show all processes)
  const allGroupsByAddress = groupInstancesByAddress(allRowsBySid);
  const allAddresses = sortAddressesByEarliestStart(allGroupsByAddress, allRowsBySid);

  // Handle dragging for range slider
  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: any) => {
      const slider = (document as any).querySelector('.range-slider-track');
      if (!slider) return;
      const rect = slider.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ts = globalStartRef.current + fraction * (globalEndRef.current - globalStartRef.current);
      if (dragging === 'start') {
        const currentEnd = rangeEndRef.current ?? globalEndRef.current;
        setRangeStart(Math.min(ts, currentEnd));
      } else if (dragging === 'end') {
        const currentStart = rangeStartRef.current ?? globalStartRef.current;
        setRangeEnd(Math.max(ts, currentStart));
      } else if (dragging === 'range') {
        const deltaX = e.clientX - dragStartXRef.current;
        const deltaFraction = deltaX / rect.width;
        const deltaTs = deltaFraction * (globalEndRef.current - globalStartRef.current);
        const span = dragStartRangeRef.current.end - dragStartRangeRef.current.start;
        let newStart = dragStartRangeRef.current.start + deltaTs;
        let newEnd = dragStartRangeRef.current.end + deltaTs;
        if (newStart < globalStartRef.current) {
          newStart = globalStartRef.current;
          newEnd = globalStartRef.current + span;
        }
        if (newEnd > globalEndRef.current) {
          newEnd = globalEndRef.current;
          newStart = globalEndRef.current - span;
        }
        setRangeStart(newStart);
        setRangeEnd(newEnd);
      }
    };
    const handleMouseUp = () => setDragging(null);
    (document as any).addEventListener('mousemove', handleMouseMove);
    (document as any).addEventListener('mouseup', handleMouseUp);
    return () => {
      (document as any).removeEventListener('mousemove', handleMouseMove);
      (document as any).removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  // Keyboard navigation for table rows
  useEffect(() => {
    const handleKeyDown = (e: any) => {
      if (panelFocus === 'timeline') {
        // Build timeline items list (ap + unclassified + db rows + sid rows)
        const timelineItems: Array<{type: 'unclassified' | 'db' | 'sid', key: string}> = [
          ...(hasUnclassified ? [{ type: 'unclassified' as const, key: 'unclassified' }] : []),
          ...Object.keys(dbStates || {}).map(db => ({ type: 'db' as const, key: db })),
          ...addresses.flatMap(addr => (groupsByAddress[addr] || []).map(sid => ({ type: 'sid' as const, key: sid })))
        ];
        
        const currentIndex = focusedTimelineItem ? timelineItems.findIndex(item => item.type === focusedTimelineItem.type && item.key === focusedTimelineItem.key) : -1;
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentIndex < timelineItems.length - 1) {
            const nextItem = timelineItems[currentIndex + 1];
            if (nextItem) {
              setFocusedTimelineItem({type: nextItem.type, key: nextItem.key, index: 0});
              if (nextItem.type === 'unclassified') {
                setSelectedUnclassified(true);
                setSelectedDb(null);
                setSelectedSid(null);
              } else if (nextItem.type === 'db') {
                setSelectedDb(nextItem.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
              } else {
                setSelectedSid(Number(nextItem.key));
                setSelectedDb(null);
                setSelectedUnclassified(false);
              }
            }
          } else {
            // Move to table
            setPanelFocus('table');
            setFocusedRowIndex(0);
            if (allTableRows.length > 0) {
              const row = allTableRows[0];
              if (row && row.type === 'db') {
                setSelectedDb(row.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
              } else if (row && row.type === 'instance' && 'instance' in row && row.instance) {
                setSelectedSid(row.instance.sid);
                setSelectedDb(null);
                setSelectedUnclassified(false);
              }
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentIndex > 0) {
            const prevItem = timelineItems[currentIndex - 1];
            if (prevItem) {
              setFocusedTimelineItem({type: prevItem.type, key: prevItem.key, index: 0});
              if (prevItem.type === 'unclassified') {
                setSelectedUnclassified(true);
                setSelectedDb(null);
                setSelectedSid(null);
              } else if (prevItem.type === 'db') {
                setSelectedDb(prevItem.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
              } else {
                setSelectedSid(Number(prevItem.key));
                setSelectedDb(null);
                setSelectedUnclassified(false);
              }
            }
          }
        } else if (e.key === 'ArrowRight' && focusedTimelineItem) {
          e.preventDefault();
          setPanelFocus('events');
          setFocusedEventIndex(0);
        }
      } else if (panelFocus === 'table') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = Math.min(focusedRowIndex + 1, allTableRows.length - 1);
          setFocusedRowIndex(newIndex);
          if (newIndex >= 0 && newIndex < allTableRows.length) {
            const row = allTableRows[newIndex];
            if (row && row.type === 'unclassified') {
              setSelectedUnclassified(true);
              setSelectedDb(null);
              setSelectedSid(null);
              setFocusedTimelineItem({type: 'unclassified', key: 'unclassified', index: 0});
            } else if (row && row.type === 'db') {
              setSelectedDb(row.key);
              setSelectedSid(null);
              setSelectedUnclassified(false);
              setFocusedTimelineItem({type: 'db', key: row.key, index: 0});
            } else if (row && row.type === 'instance' && 'instance' in row && row.instance) {
              setSelectedSid(row.instance.sid);
              setSelectedDb(null);
              setSelectedUnclassified(false);
              setFocusedTimelineItem({type: 'sid', key: String(row.instance.sid), index: 0});
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = Math.max(focusedRowIndex - 1, 0);
          if (focusedRowIndex === 0) {
            // Go back to timeline
            setPanelFocus('timeline');
            // Focus last timeline item
            const timelineItems: Array<{type: 'db' | 'sid', key: string}> = [
              ...Object.keys(dbStates || {}).map(db => ({ type: 'db' as const, key: db })),
              ...addresses.flatMap(addr => (groupsByAddress[addr] || []).map(sid => ({ type: 'sid' as const, key: sid })))
            ];
            if (timelineItems.length > 0) {
              const lastItem = timelineItems[timelineItems.length - 1];
              if (lastItem) {
                setFocusedTimelineItem({type: lastItem.type, key: lastItem.key, index: 0});
                if (lastItem.type === 'db') {
                  setSelectedDb(lastItem.key);
                  setSelectedSid(null);
                } else {
                  setSelectedSid(Number(lastItem.key));
                  setSelectedDb(null);
                }
              }
            }
          } else {
            setFocusedRowIndex(newIndex);
            if (newIndex >= 0 && newIndex < allTableRows.length) {
              const row = allTableRows[newIndex];
              if (row && row.type === 'db') {
                setSelectedDb(row.key);
                setSelectedSid(null);
                setSelectedUnclassified(false);
                setFocusedTimelineItem({type: 'db', key: row.key, index: 0});
              } else if (row && row.type === 'instance' && 'instance' in row && row.instance) {
                setSelectedSid(row.instance.sid);
                setSelectedDb(null);
                setSelectedUnclassified(false);
                setFocusedTimelineItem({type: 'sid', key: String(row.instance.sid), index: 0});
              }
            }
          }
        } else if (e.key === 'ArrowRight' && (selectedSid !== null || selectedDb !== null || selectedUnclassified)) {
          e.preventDefault();
          setPanelFocus('events');
          setFocusedEventIndex(0);
        }
      } else if (panelFocus === 'events') {
        // Get current event list
        let eventCount = 0;
        if (selectedUnclassified) {
          eventCount = unclassifiedEvents.length;
        } else if (selectedDb !== null) {
          // Count all database events (state events + specific events)
          const dbStateEvents = dbStates[selectedDb] || [];
          const dbSpecificEvents = databaseEvents.filter((e: any) => {
            const msg = e.message ?? '';
            const raw = e.raw ?? '';
            return msg.includes(selectedDb) || raw.includes(selectedDb);
          });
          eventCount = dbStateEvents.length + dbSpecificEvents.length;
        } else if (selectedSid !== null) {
          const instsForSid = rowsBySid[String(selectedSid)] || [];
          const related = events.filter((e: any) => {
            // Exact match for events with a startId
            if (e.sid === selectedSid) return true;
            // Include events without a startId if they fall within the process's lifetime
            if (e.sid === null && instsForSid.length > 0) {
              return instsForSid.some(inst => e.ts >= inst.start && e.ts <= inst.end);
            }
            return false;
          });
          const frpForSid = failureProtocols.filter(frp => frp.sid === selectedSid);
          eventCount = related.length + frpForSid.length;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = Math.min(focusedEventIndex + 1, eventCount - 1);
          setFocusedEventIndex(newIndex);
          // Scroll focused event into view
          setTimeout(() => {
            const focusedEl = (document as any).querySelector('.event-item.focused');
            if (focusedEl) focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 10);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = Math.max(focusedEventIndex - 1, 0);
          setFocusedEventIndex(newIndex);
          // Scroll focused event into view
          setTimeout(() => {
            const focusedEl = (document as any).querySelector('.event-item.focused');
            if (focusedEl) focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 10);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setPanelFocus('table');
        }
      }
    };
    (document as any).addEventListener('keydown', handleKeyDown);
    return () => (document as any).removeEventListener('keydown', handleKeyDown);
  }, [focusedRowIndex, focusedEventIndex, focusedTimelineItem, panelFocus, allTableRows, selectedSid, selectedDb, selectedUnclassified, dbStates, databaseEvents, events, failureProtocols, rowsBySid, addresses, groupsByAddress, hasUnclassified]);

  return (
    <div className="app">
      <Controls
        loadMode={loadMode}
        setLoadMode={setLoadMode}
        path={path}
        setPath={setPath}
        loading={loading}
        onLoad={load}
        selectedTicket={selectedTicket}
        setSelectedTicket={setSelectedTicket}
        zdTickets={zdTickets}
        selectedPackage={selectedPackage}
        setSelectedPackage={setSelectedPackage}
        diagnosePackages={diagnosePackages}
        collectionItems={collectionItems}
        selectedCollection={selectedCollection}
        setSelectedCollection={setSelectedCollection}
        theme={theme}
        setTheme={setTheme}
        domainStatePanelOpen={domainPanelOpen}
        setDomainStatePanelOpen={setDomainPanelOpen}
        mainViewMode={mainViewMode}
        setMainViewMode={setMainViewMode}
        selectedServer={selectedServer}
        onFilesViewClick={loadFileList}
      />

      <ServerTimeline
        loadMode={loadMode}
        selectedPackage={selectedPackage}
        serverTimeRanges={serverTimeRanges}
        selectedServer={selectedServer}
        setSelectedServer={setSelectedServer}
        apsCollapsed={apsCollapsed}
        setApsCollapsed={setApsCollapsed}
        setHoveredBar={setHoveredBar}
        setMousePos={setMousePos}
        loadedServer={loadedServer}
      />

      <LoadingSpinner visible={loading && loadMode === 'tickets'} />

      {/* Main content - hidden when loading */}
      {(!loading || loadMode !== 'tickets') && mainViewMode === 'timeline' && (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Timeline and Domain State Panel Row */}
        <div 
          className="main-layout"
          style={{
            flex: selectedSid !== null || selectedDb !== null || selectedAp !== null || selectedUnclassified 
              ? `0 0 ${timelineHeight}%` 
              : '1',
            minHeight: selectedSid !== null || selectedDb !== null || selectedAp !== null || selectedUnclassified 
              ? '200px' 
              : undefined,
          }}
        >
          <div 
            className="timeline-container" 
            style={{ 
              flex: domainPanelOpen ? 'none' : '1',
              width: domainPanelOpen ? `calc(100% - ${domainPanelWidth}px - 16px)` : '100%'
            }}
          >
            <div 
              className="timeline" 
              onMouseMove={(e: any) => setMousePos({x: e.clientX, y: e.clientY})}
            >
            <FilterBar
              filterType={filterType}
              setFilterType={setFilterType}
              filterServers={filterServers}
              setFilterServers={setFilterServers}
              filterSids={filterSids}
              setFilterSids={setFilterSids}
              typeOptions={typeOptions}
              allServers={allServers}
              allSids={allSids}
              serverDropdownOpen={serverDropdownOpen}
              setServerDropdownOpen={setServerDropdownOpen}
              sidDropdownOpen={sidDropdownOpen}
              setSidDropdownOpen={setSidDropdownOpen}
              globalStart={globalStart}
              globalEnd={globalEnd}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              setRangeStart={setRangeStart}
              setRangeEnd={setRangeEnd}
            />

            <RangeSlider
              globalStart={globalStart}
              globalEnd={globalEnd}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              setRangeStart={setRangeStart}
              setRangeEnd={setRangeEnd}
              dragging={dragging}
              setDragging={setDragging}
              setDragStartX={setDragStartX}
              setDragStartRange={setDragStartRange}
              allRowsBySid={allRowsBySid}
              dbStates={dbStates}
              events={events}
              failureProtocols={failureProtocols}
              addresses={allAddresses}
              groupsByAddress={allGroupsByAddress}
              leadingContent={(
                <FilterControls
                  filterType={filterType}
                  setFilterType={setFilterType}
                  filterServers={filterServers}
                  setFilterServers={setFilterServers}
                  filterSids={filterSids}
                  setFilterSids={setFilterSids}
                  typeOptions={typeOptions}
                  allServers={allServers}
                  allSids={allSids}
                  serverDropdownOpen={serverDropdownOpen}
                  setServerDropdownOpen={setServerDropdownOpen}
                  sidDropdownOpen={sidDropdownOpen}
                  setSidDropdownOpen={setSidDropdownOpen}
                  compact
                />
              )}
            />

            {/* TimePoint Slider + AP events - merged row */}
            <div className="timepoint-slider-wrapper">
              <TimePointSlider
                globalStart={gStart}
                globalEnd={gEnd}
                currentTime={currentTimePoint}
                setCurrentTime={setCurrentTimePoint}
                allStateTimestamps={visibleDomainStateTimestamps}
                onNext={handleNextState}
                onPrev={handlePrevState}
                hasDomainStates={visibleDomainStateTimestamps.length > 0}
                processEvents={processEvents}
                loadedServer={loadedServer}
                focusedTimelineItem={focusedTimelineItem}
                setFocusedTimelineItem={setFocusedTimelineItem}
                setPanelFocus={setPanelFocus}
                setSelectedAp={setSelectedAp}
                setSelectedSid={setSelectedSid}
                setSelectedDb={setSelectedDb}
                setSelectedUnclassified={setSelectedUnclassified}
                setHoveredBar={setHoveredBar}
              />
            </div>
            
            <DatabaseTimeline
              dbStates={dbStates}
              events={events}
              gStart={gStart}
              gEnd={gEnd}
              cursorX={cursorX}
              setCursorX={setCursorX}
              focusedTimelineItem={focusedTimelineItem}
              setFocusedTimelineItem={setFocusedTimelineItem}
              setPanelFocus={setPanelFocus}
              setSelectedDb={setSelectedDb}
              setSelectedSid={setSelectedSid}
              setHoveredBar={setHoveredBar}
            />
            
            <UnclassifiedEventsRow
              unclassifiedEvents={unclassifiedEvents}
              gStart={gStart}
              gEnd={gEnd}
              selectedUnclassified={selectedUnclassified}
              setSelectedUnclassified={setSelectedUnclassified}
              setSelectedSid={setSelectedSid}
              setSelectedDb={setSelectedDb}
              setPanelFocus={setPanelFocus}
              setFocusedTimelineItem={setFocusedTimelineItem}
              setHoveredBar={setHoveredBar}
            />
            
            <ProcessTimeline
              addresses={addresses}
              groupsByAddress={groupsByAddress}
              rowsBySid={rowsBySid}
              allRowsBySid={allRowsBySid}
              events={events}
              failureProtocols={failureProtocols}
              gStart={gStart}
              gEnd={gEnd}
              globalEnd={globalEnd}
              cursorX={cursorX}
              setCursorX={setCursorX}
              focusedTimelineItem={focusedTimelineItem}
              setFocusedTimelineItem={setFocusedTimelineItem}
              setPanelFocus={setPanelFocus}
              setSelectedSid={setSelectedSid}
              setSelectedDb={setSelectedDb}
              setSelectedAp={setSelectedAp}
              setSelectedUnclassified={setSelectedUnclassified}
              setHoveredBar={setHoveredBar}
            />

            <Tooltip hoveredBar={hoveredBar} mousePos={mousePos} />
          </div>
        </div>
        
        {/* Resize handle */}
        {domainPanelOpen && (
          <div 
            className="panel-resize-handle"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
        
        {/* Domain State Panel - collapsible on the right, always visible */}
        <div style={{ width: domainPanelOpen ? `${domainPanelWidth}px` : 'auto' }}>
          <DomainStatePanel
            currentSnapshot={currentDomainStateSnapshot}
            previousSnapshot={previousDomainStateSnapshot}
            currentFrame={currentDomainStateFrame}
            totalFrames={visibleDomainStates.length}
            onNext={handleNextState}
            onPrev={handlePrevState}
            hasNext={visibleDomainStates.some(ds => ds.timestamp > (currentTimePoint || 0))}
            hasPrev={visibleDomainStates.some(ds => ds.timestamp < (currentTimePoint || Infinity))}
            isOpen={domainPanelOpen}
            onClose={() => setDomainPanelOpen(false)}
          />
        </div>
      </div>

      {/* Resize handle between timeline row and log panel */}
      {(selectedSid !== null || selectedDb !== null || selectedAp !== null || selectedUnclassified) && (
        <div 
          style={{
            height: '4px',
            cursor: 'row-resize',
            background: 'transparent',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 0.2s',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          onMouseDown={() => setIsResizingTimeline(true)}
        >
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '-4px',
            bottom: '-4px',
          }} />
        </div>
      )}

      {/* Log Panel - spans full width */}
      <div style={{
        flex: (selectedSid !== null || selectedDb !== null || selectedAp !== null || selectedUnclassified) 
          ? 1 
          : 0,
        minHeight: (selectedSid !== null || selectedDb !== null || selectedAp !== null || selectedUnclassified) 
          ? '200px' 
          : 0,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <LogPanel
              selectedSid={selectedSid}
              selectedDb={selectedDb}
              selectedAp={selectedAp}
              selectedUnclassified={selectedUnclassified}
              setSelectedSid={setSelectedSid}
              setSelectedDb={setSelectedDb}
              setSelectedAp={setSelectedAp}
              setSelectedUnclassified={setSelectedUnclassified}
              unclassifiedEvents={unclassifiedEvents}
              databaseEvents={databaseEvents}
              processEvents={processEvents}
              events={events}
              dbStates={dbStates}
              failureProtocols={failureProtocols}
              rowsBySid={rowsBySid}
              panelFocus={panelFocus}
              focusedEventIndex={focusedEventIndex}
              setFocusedEventIndex={setFocusedEventIndex}
              setPanelFocus={setPanelFocus}
              loadedServer={loadedServer}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
        />
      </div>
      </div>
      )}      {/* File Viewer - shown when mainViewMode is 'files' */}
      {mainViewMode === 'files' && (
        <div className="file-viewer" style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'var(--bg-primary)',
        }}>
          {/* File List Sidebar */}
          <div style={{
            width: 300,
            borderRight: '1px solid var(--border-primary)',
            overflow: 'auto',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-primary)',
              flexShrink: 0,
            }}>
              <div style={{
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}>
                Files in {selectedServer || 'server'}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search text in files..."
                  value={fileListSearch}
                  onChange={(e) => {
                    setFileListSearch(e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 28px 6px 8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 4,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                />
                {fileListSearch && (
                  <button
                    onClick={() => {
                      setFileListSearch('');
                      setFileSearchResults([]);
                    }}
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                      fontSize: 14,
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, gap: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fileSearchRegex}
                    onChange={(e) => setFileSearchRegex(e.target.checked)}
                    style={{ marginRight: 4 }}
                  />
                  .*
                </label>
              </div>
              {fileListSearch && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginTop: 4,
                }}>
                  {isSearchingFiles ? (
                    'Searching...'
                  ) : fileListSearch.length < 3 ? (
                    'Type at least 3 characters'
                  ) : (
                    `${fileSearchResults.length} files with matches`
                  )}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {availableFiles.length === 0 ? (
                <div style={{
                  padding: 16,
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontStyle: 'italic',
                }}>
                  No files available
                </div>
              ) : filteredFiles.length === 0 && fileListSearch ? (
                <div style={{
                  padding: 16,
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontStyle: 'italic',
                }}>
                  {isSearchingFiles ? 'Searching...' : 'No files contain this text'}
                </div>
              ) : (
                filteredFiles.map((file, idx) => {
                  const matchInfo = fileSearchResults.find(r => r.file === file);
                  return (
                  <div
                    key={idx}
                    onClick={() => loadFileContent(file)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      background: selectedFile === file ? 'var(--button-bg)' : 'transparent',
                      color: selectedFile === file ? 'var(--text-primary)' : 'var(--text-secondary)',
                      borderBottom: '1px solid var(--border-primary)',
                      fontSize: 13,
                      fontFamily: 'monospace',
                      transition: 'background 0.15s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFile !== file) {
                        e.currentTarget.style.background = 'rgba(159, 180, 201, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFile !== file) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span>{file}</span>
                    {matchInfo && (
                      <span style={{
                        fontSize: 10,
                        background: 'rgba(43, 157, 244, 0.2)',
                        color: '#43bdff',
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontWeight: 600,
                      }}>
                        {matchInfo.matches}
                      </span>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>

          {/* File Content Viewer */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-primary)',
          }}>
            {selectedFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{
                  flexShrink: 0,
                  background: 'var(--bg-primary)',
                  zIndex: 10,
                  padding: 20,
                  borderBottom: '1px solid var(--border-primary)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <div>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                      }}>
                        {selectedFile}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginTop: 4,
                      }}>
                        {fileContent.split('\\n').length.toLocaleString()} lines
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Search in file..."
                          value={fileContentSearch}
                          onChange={(e) => {
                            setFileContentSearch(e.target.value);
                          }}
                          style={{
                            padding: '6px 28px 6px 8px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 4,
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            fontFamily: 'monospace',
                            width: 200,
                          }}
                        />
                        {fileContentSearch && (
                          <button
                            onClick={() => {
                              setFileContentSearch('');
                              setCurrentMatchIndex(0);
                            }}
                            style={{
                              position: 'absolute',
                              right: 4,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: 4,
                              fontSize: 14,
                            }}
                            title="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={fileContentSearchRegex}
                          onChange={(e) => {
                            setFileContentSearchRegex(e.target.checked);
                          }}
                          style={{ marginRight: 4 }}
                        />
                        .*
                      </label>
                      {contentMatches.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            onClick={goToPrevMatch}
                            style={{
                              background: 'var(--button-bg)',
                              border: 'none',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: 3,
                              fontSize: 12,
                            }}
                            title="Previous match"
                          >
                            ↑
                          </button>
                          <button
                            onClick={goToNextMatch}
                            style={{
                              background: 'var(--button-bg)',
                              border: 'none',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: 3,
                              fontSize: 12,
                            }}
                            title="Next match"
                          >
                            ↓
                          </button>
                          <div style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            marginLeft: 4,
                          }}>
                            {currentMatchIndex + 1} / {contentMatches.length}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px 20px', minHeight: 0 }}>
                  {fileContentSearch && contentMatches.length > 0 ? (
                    <pre style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      margin: 0,
                    }}>
                    {(() => {
                      const parts: JSX.Element[] = [];
                      let lastIndex = 0;

                      contentMatches.forEach((match, i) => {
                        // Add text before match
                        if (match.index > lastIndex) {
                          parts.push(
                            <span key={`text-${i}`}>{fileContent.substring(lastIndex, match.index)}</span>
                          );
                        }
                        
                        // Add highlighted match
                        const isCurrent = i === currentMatchIndex;
                        parts.push(
                          <span
                            key={`match-${i}`}
                            id={isCurrent ? 'current-match' : undefined}
                            style={{
                              background: isCurrent ? '#ffaa00' : '#ffff00',
                              color: '#000',
                              fontWeight: isCurrent ? 600 : 400,
                              padding: '2px 0',
                            }}
                          >
                            {fileContent.substring(match.index, match.index + match.length)}
                          </span>
                        );
                        
                        lastIndex = match.index + match.length;
                      });

                      // Add remaining text
                      if (lastIndex < fileContent.length) {
                        parts.push(
                          <span key="text-end">{fileContent.substring(lastIndex)}</span>
                        );
                      }

                      // Scroll to current match
                      setTimeout(() => {
                        const elem = document.getElementById('current-match');
                        if (elem) {
                          elem.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        }
                      }, 100);

                      return parts;
                    })()}
                  </pre>
                ) : (
                  <pre style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    margin: 0,
                  }}>
                    {fileContent}
                  </pre>
                )}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                fontSize: 14,
                fontStyle: 'italic',
              }}>
                Select a file to view its contents
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

//@ts-ignore
assert(document);
//@ts-ignore
const root = createRoot(document.getElementById('root')!);
root.render(<StackApp />);

