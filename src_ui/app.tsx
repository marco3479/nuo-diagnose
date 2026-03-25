import React, { useEffect, useState, type JSX } from 'react';
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
  PanelFocus,
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
  useFileViewerState,
  useKeyboardNavigation,
  useLayoutInteractions,
} from './appHooks';
import {
  Controls,
  MainTimelineView,
  ServerTimeline,
  LoadingSpinner,
  FileViewer,
} from './components';
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
  const [panelFocus, setPanelFocus] = useState<PanelFocus>('timeline');
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
  const [logLevelFilter, setLogLevelFilter] = useState<string>('All levels');

  const { theme, setTheme } = useTheme('dark');
  const { mousePos, setMousePos } = useMousePosition();
  const zdTickets = useZdTickets();

  const {
    availableFiles,
    selectedFile,
    fileContent,
    fileListSearch,
    setFileListSearch,
    fileContentSearch,
    setFileContentSearch,
    currentMatchIndex,
    setCurrentMatchIndex,
    fileSearchResults,
    clearFileSearchResults,
    isSearchingFiles,
    fileSearchRegex,
    setFileSearchRegex,
    fileContentSearchRegex,
    setFileContentSearchRegex,
    contentMatches,
    filteredFiles,
    loadFileList,
    loadFileContent,
    goToNextMatch,
    goToPrevMatch,
  } = useFileViewerState({
    loadMode,
    mainViewMode,
    selectedTicket,
    selectedPackage,
    selectedServer,
  });

  useLayoutInteractions({
    globalStart,
    globalEnd,
    rangeStart,
    rangeEnd,
    setRangeStart,
    setRangeEnd,
    dragging,
    setDragging,
    dragStartX,
    dragStartRange,
    isResizing,
    setIsResizing,
    setDomainPanelWidth,
    isResizingTimeline,
    setIsResizingTimeline,
    setTimelineHeight,
  });

  useDropdownOutsideClick(serverDropdownOpen, sidDropdownOpen, setServerDropdownOpen, setSidDropdownOpen);
  useUrlNavigation(loadMode);

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

  // Group sids by address (for filtered/visible timeline)
  const groupsByAddress = groupInstancesByAddress(rowsBySid);
  const addresses = sortAddressesByEarliestStart(groupsByAddress, rowsBySid);

  // Group all sids by address (for minimap - always show all processes)
  const allGroupsByAddress = groupInstancesByAddress(allRowsBySid);
  const allAddresses = sortAddressesByEarliestStart(allGroupsByAddress, allRowsBySid);

  useKeyboardNavigation({
    focusedRowIndex,
    setFocusedRowIndex,
    focusedEventIndex,
    setFocusedEventIndex,
    panelFocus,
    setPanelFocus,
    focusedTimelineItem,
    setFocusedTimelineItem,
    allTableRows,
    selectedSid,
    setSelectedSid,
    selectedDb,
    setSelectedDb,
    selectedUnclassified,
    setSelectedUnclassified,
    dbStates,
    databaseEvents,
    unclassifiedEvents,
    events,
    failureProtocols,
    rowsBySid,
    addresses,
    groupsByAddress,
    hasUnclassified,
  });

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

      {(!loading || loadMode !== 'tickets') && mainViewMode === 'timeline' && (
        <MainTimelineView
          selectedSid={selectedSid}
          selectedDb={selectedDb}
          selectedAp={selectedAp}
          selectedUnclassified={selectedUnclassified}
          timelineHeight={timelineHeight}
          domainPanelOpen={domainPanelOpen}
          domainPanelWidth={domainPanelWidth}
          setMousePos={setMousePos}
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
          dragging={dragging}
          setDragging={setDragging}
          setDragStartX={setDragStartX}
          setDragStartRange={setDragStartRange}
          allRowsBySid={allRowsBySid}
          dbStates={dbStates}
          events={events}
          failureProtocols={failureProtocols}
          allAddresses={allAddresses}
          allGroupsByAddress={allGroupsByAddress}
          gStart={gStart}
          gEnd={gEnd}
          currentTimePoint={currentTimePoint}
          setCurrentTimePoint={setCurrentTimePoint}
          visibleDomainStateTimestamps={visibleDomainStateTimestamps}
          handleNextState={handleNextState}
          handlePrevState={handlePrevState}
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
          cursorX={cursorX}
          setCursorX={setCursorX}
          unclassifiedEvents={unclassifiedEvents}
          addresses={addresses}
          groupsByAddress={groupsByAddress}
          hoveredBar={hoveredBar}
          mousePos={mousePos}
          setIsResizing={setIsResizing}
          currentDomainStateSnapshot={currentDomainStateSnapshot}
          previousDomainStateSnapshot={previousDomainStateSnapshot}
          currentDomainStateFrame={currentDomainStateFrame}
          visibleDomainStates={visibleDomainStates}
          setDomainPanelOpen={setDomainPanelOpen}
          setIsResizingTimeline={setIsResizingTimeline}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          databaseEvents={databaseEvents}
          rowsBySid={rowsBySid}
          logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
        />
      )}

      {mainViewMode === 'files' && (
        <FileViewer
          selectedServer={selectedServer}
          availableFiles={availableFiles}
          filteredFiles={filteredFiles}
          selectedFile={selectedFile}
          fileContent={fileContent}
          fileListSearch={fileListSearch}
          setFileListSearch={setFileListSearch}
          fileSearchResults={fileSearchResults}
          clearFileSearchResults={clearFileSearchResults}
          isSearchingFiles={isSearchingFiles}
          fileSearchRegex={fileSearchRegex}
          setFileSearchRegex={setFileSearchRegex}
          loadFileContent={loadFileContent}
          fileContentSearch={fileContentSearch}
          setFileContentSearch={setFileContentSearch}
          fileContentSearchRegex={fileContentSearchRegex}
          setFileContentSearchRegex={setFileContentSearchRegex}
          contentMatches={contentMatches}
          currentMatchIndex={currentMatchIndex}
          setCurrentMatchIndex={setCurrentMatchIndex}
          goToPrevMatch={goToPrevMatch}
          goToNextMatch={goToNextMatch}
        />
      )}
    </div>
  );
}

//@ts-ignore
assert(document);
//@ts-ignore
const root = createRoot(document.getElementById('root')!);
root.render(<StackApp />);

