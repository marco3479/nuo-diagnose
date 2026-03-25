import type { JSX } from 'react';
import { ApPanel } from './log-panel/ApPanel';
import { DatabasePanel } from './log-panel/DatabasePanel';
import { ProcessPanel } from './log-panel/ProcessPanel';
import { UnclassifiedPanel } from './log-panel/UnclassifiedPanel';
import { EmptyLogSelection } from './log-panel/shared';
import type { EnrichedEvent, LogPanelProps } from './log-panel/types';

export type { LogPanelProps } from './log-panel/types';

export function LogPanel({
  selectedSid,
  selectedDb,
  selectedAp,
  selectedUnclassified,
  setSelectedSid,
  setSelectedDb,
  setSelectedAp,
  setSelectedUnclassified,
  unclassifiedEvents,
  databaseEvents,
  processEvents,
  events,
  dbStates,
  failureProtocols,
  rowsBySid,
  panelFocus,
  focusedEventIndex,
  setFocusedEventIndex,
  setPanelFocus,
  loadedServer,
  rangeStart,
  rangeEnd,
  logLevelFilter,
  setLogLevelFilter,
}: LogPanelProps): JSX.Element {
  if (selectedSid === null && selectedDb === null && selectedAp === null && !selectedUnclassified) {
    return <EmptyLogSelection />;
  }

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-secondary)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: 1,
      }}
    >
      {selectedUnclassified ? (
        <UnclassifiedPanel
          unclassifiedEvents={unclassifiedEvents}
          setSelectedUnclassified={setSelectedUnclassified}
          setSelectedAp={setSelectedAp}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          setPanelFocus={setPanelFocus}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
        />
      ) : selectedDb !== null ? (
        <DatabasePanel
          selectedDb={selectedDb}
          setSelectedDb={setSelectedDb}
          setSelectedAp={setSelectedAp}
          dbStates={dbStates}
          databaseEvents={databaseEvents as EnrichedEvent[]}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          setPanelFocus={setPanelFocus}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
        />
      ) : selectedAp !== null ? (
        <ApPanel
          selectedAp={selectedAp}
          setSelectedAp={setSelectedAp}
          processEvents={processEvents as EnrichedEvent[]}
          panelFocus={panelFocus}
          focusedEventIndex={focusedEventIndex}
          setFocusedEventIndex={setFocusedEventIndex}
          setPanelFocus={setPanelFocus}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          logLevelFilter={logLevelFilter}
          setLogLevelFilter={setLogLevelFilter}
        />
      ) : (
        <ProcessPanel
          selectedSid={selectedSid!}
          setSelectedSid={setSelectedSid}
          setSelectedAp={setSelectedAp}
          events={events}
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
      )}
    </div>
  );
}
