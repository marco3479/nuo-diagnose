import type { JSX } from 'react';
import type {
  DbStates,
  EventType,
  FailureProtocol,
  FocusedTimelineItem,
  HoveredBar,
  Instance,
  PanelFocus,
  DomainStateSnapshot,
} from '../types';
import {
  FilterBar,
  FilterControls,
  RangeSlider,
  Tooltip,
  DatabaseTimeline,
  UnclassifiedEventsRow,
  ProcessTimeline,
  LogPanel,
  TimePointSlider,
  DomainStatePanel,
} from './index';

type MainTimelineViewProps = {
  selectedSid: number | null;
  selectedDb: string | null;
  selectedAp: string | null;
  selectedUnclassified: boolean;
  timelineHeight: number;
  domainPanelOpen: boolean;
  domainPanelWidth: number;
  setMousePos: (value: { x: number; y: number }) => void;
  filterType: string;
  setFilterType: (value: string) => void;
  filterServers: Set<string>;
  setFilterServers: (value: Set<string>) => void;
  filterSids: Set<string>;
  setFilterSids: (value: Set<string>) => void;
  typeOptions: string[];
  allServers: string[];
  allSids: string[];
  serverDropdownOpen: boolean;
  setServerDropdownOpen: (value: boolean) => void;
  sidDropdownOpen: boolean;
  setSidDropdownOpen: (value: boolean) => void;
  globalStart: number;
  globalEnd: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  setRangeStart: (value: number | null) => void;
  setRangeEnd: (value: number | null) => void;
  dragging: 'start' | 'end' | 'range' | null;
  setDragging: (value: 'start' | 'end' | 'range' | null) => void;
  setDragStartX: (value: number) => void;
  setDragStartRange: (value: { start: number; end: number }) => void;
  allRowsBySid: Record<string, Instance[]>;
  dbStates: DbStates;
  events: EventType[];
  failureProtocols: FailureProtocol[];
  allAddresses: string[];
  allGroupsByAddress: Record<string, string[]>;
  gStart: number;
  gEnd: number;
  currentTimePoint: number | null;
  setCurrentTimePoint: (value: number | null) => void;
  visibleDomainStateTimestamps: number[];
  handleNextState: () => void;
  handlePrevState: () => void;
  processEvents: EventType[];
  loadedServer: string;
  focusedTimelineItem: FocusedTimelineItem | null;
  setFocusedTimelineItem: (value: FocusedTimelineItem | null) => void;
  setPanelFocus: (value: PanelFocus) => void;
  setSelectedAp: (value: string | null) => void;
  setSelectedSid: (value: number | null) => void;
  setSelectedDb: (value: string | null) => void;
  setSelectedUnclassified: (value: boolean) => void;
  setHoveredBar: (value: HoveredBar | null) => void;
  cursorX: number | null;
  setCursorX: (value: number | null) => void;
  unclassifiedEvents: EventType[];
  addresses: string[];
  groupsByAddress: Record<string, string[]>;
  hoveredBar: HoveredBar | null;
  mousePos: { x: number; y: number };
  setIsResizing: (value: boolean) => void;
  currentDomainStateSnapshot: DomainStateSnapshot | null;
  previousDomainStateSnapshot: DomainStateSnapshot | null;
  currentDomainStateFrame: number;
  visibleDomainStates: DomainStateSnapshot[];
  setDomainPanelOpen: (value: boolean) => void;
  setIsResizingTimeline: (value: boolean) => void;
  panelFocus: PanelFocus;
  focusedEventIndex: number;
  setFocusedEventIndex: (value: number) => void;
  databaseEvents: EventType[];
  rowsBySid: Record<string, Instance[]>;
  logLevelFilter: string;
  setLogLevelFilter: (value: string) => void;
};

export function MainTimelineView({
  selectedSid,
  selectedDb,
  selectedAp,
  selectedUnclassified,
  timelineHeight,
  domainPanelOpen,
  domainPanelWidth,
  setMousePos,
  filterType,
  setFilterType,
  filterServers,
  setFilterServers,
  filterSids,
  setFilterSids,
  typeOptions,
  allServers,
  allSids,
  serverDropdownOpen,
  setServerDropdownOpen,
  sidDropdownOpen,
  setSidDropdownOpen,
  globalStart,
  globalEnd,
  rangeStart,
  rangeEnd,
  setRangeStart,
  setRangeEnd,
  dragging,
  setDragging,
  setDragStartX,
  setDragStartRange,
  allRowsBySid,
  dbStates,
  events,
  failureProtocols,
  allAddresses,
  allGroupsByAddress,
  gStart,
  gEnd,
  currentTimePoint,
  setCurrentTimePoint,
  visibleDomainStateTimestamps,
  handleNextState,
  handlePrevState,
  processEvents,
  loadedServer,
  focusedTimelineItem,
  setFocusedTimelineItem,
  setPanelFocus,
  setSelectedAp,
  setSelectedSid,
  setSelectedDb,
  setSelectedUnclassified,
  setHoveredBar,
  cursorX,
  setCursorX,
  unclassifiedEvents,
  addresses,
  groupsByAddress,
  hoveredBar,
  mousePos,
  setIsResizing,
  currentDomainStateSnapshot,
  previousDomainStateSnapshot,
  currentDomainStateFrame,
  visibleDomainStates,
  setDomainPanelOpen,
  setIsResizingTimeline,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  databaseEvents,
  rowsBySid,
  logLevelFilter,
  setLogLevelFilter,
}: MainTimelineViewProps): JSX.Element {
  const hasSelection =
    selectedSid !== null || selectedDb !== null || selectedAp !== null || selectedUnclassified;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        className="main-layout"
        style={{
          flex: hasSelection ? `0 0 ${timelineHeight}%` : '1',
          minHeight: hasSelection ? '200px' : undefined,
        }}
      >
        <div
          className="timeline-container"
          style={{
            flex: domainPanelOpen ? 'none' : '1',
            width: domainPanelOpen ? `calc(100% - ${domainPanelWidth}px - 16px)` : '100%',
          }}
        >
          <div
            className="timeline"
            onMouseMove={(e: any) => setMousePos({ x: e.clientX, y: e.clientY })}
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

        {domainPanelOpen && (
          <div className="panel-resize-handle" onMouseDown={() => setIsResizing(true)} />
        )}

        <div style={{ width: domainPanelOpen ? `${domainPanelWidth}px` : 'auto' }}>
          <DomainStatePanel
            currentSnapshot={currentDomainStateSnapshot}
            previousSnapshot={previousDomainStateSnapshot}
            currentFrame={currentDomainStateFrame}
            totalFrames={visibleDomainStates.length}
            onNext={handleNextState}
            onPrev={handlePrevState}
            hasNext={visibleDomainStates.some((state) => state.timestamp > (currentTimePoint || 0))}
            hasPrev={visibleDomainStates.some((state) => state.timestamp < (currentTimePoint || Infinity))}
            isOpen={domainPanelOpen}
            onClose={() => setDomainPanelOpen(false)}
          />
        </div>
      </div>

      {hasSelection && (
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
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '-4px',
              bottom: '-4px',
            }}
          />
        </div>
      )}

      <div
        style={{
          flex: hasSelection ? 1 : 0,
          minHeight: hasSelection ? '200px' : 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
  );
}