import { useEffect, type JSX } from 'react';
import type { ContentMatch, FileSearchResult } from '../fileSearch';

type FileViewerProps = {
  selectedServer: string;
  availableFiles: string[];
  filteredFiles: string[];
  selectedFile: string | null;
  fileContent: string;
  fileListSearch: string;
  setFileListSearch: (value: string) => void;
  fileSearchResults: FileSearchResult[];
  clearFileSearchResults: () => void;
  isSearchingFiles: boolean;
  fileSearchRegex: boolean;
  setFileSearchRegex: (value: boolean) => void;
  loadFileContent: (filename: string) => void;
  fileContentSearch: string;
  setFileContentSearch: (value: string) => void;
  fileContentSearchRegex: boolean;
  setFileContentSearchRegex: (value: boolean) => void;
  contentMatches: ContentMatch[];
  currentMatchIndex: number;
  setCurrentMatchIndex: (value: number) => void;
  goToPrevMatch: () => void;
  goToNextMatch: () => void;
};

function HighlightedContent({
  fileContent,
  contentMatches,
  currentMatchIndex,
}: {
  fileContent: string;
  contentMatches: ContentMatch[];
  currentMatchIndex: number;
}): JSX.Element {
  const parts: JSX.Element[] = [];
  let lastIndex = 0;

  contentMatches.forEach((match, index) => {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>{fileContent.substring(lastIndex, match.index)}</span>
      );
    }

    const isCurrent = index === currentMatchIndex;
    parts.push(
      <span
        key={`match-${index}`}
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

  if (lastIndex < fileContent.length) {
    parts.push(<span key="text-end">{fileContent.substring(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

export function FileViewer({
  selectedServer,
  availableFiles,
  filteredFiles,
  selectedFile,
  fileContent,
  fileListSearch,
  setFileListSearch,
  fileSearchResults,
  clearFileSearchResults,
  isSearchingFiles,
  fileSearchRegex,
  setFileSearchRegex,
  loadFileContent,
  fileContentSearch,
  setFileContentSearch,
  fileContentSearchRegex,
  setFileContentSearchRegex,
  contentMatches,
  currentMatchIndex,
  setCurrentMatchIndex,
  goToPrevMatch,
  goToNextMatch,
}: FileViewerProps): JSX.Element {
  useEffect(() => {
    if (contentMatches.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const element = document.getElementById('current-match');
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, [contentMatches, currentMatchIndex]);

  return (
    <div className="file-viewer">
      <div className="file-viewer-sidebar">
        <div className="file-viewer-sidebar-header">
          <div className="file-viewer-sidebar-title">Files in {selectedServer || 'server'}</div>
          <div className="file-viewer-search-input-wrapper">
            <input
              type="text"
              placeholder="Search text in files..."
              value={fileListSearch}
              onChange={(event) => setFileListSearch(event.target.value)}
              className="file-viewer-search-input"
            />
            {fileListSearch && (
              <button
                onClick={() => {
                  setFileListSearch('');
                  clearFileSearchResults();
                }}
                className="file-viewer-clear-button"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="file-viewer-search-meta">
            <label className="file-viewer-checkbox-label">
              <input
                type="checkbox"
                checked={fileSearchRegex}
                onChange={(event) => setFileSearchRegex(event.target.checked)}
              />
              .*
            </label>
          </div>
          {fileListSearch && (
            <div className="file-viewer-helper-text">
              {isSearchingFiles
                ? 'Searching...'
                : fileListSearch.length < 3
                ? 'Type at least 3 characters'
                : `${fileSearchResults.length} files with matches`}
            </div>
          )}
        </div>

        <div className="file-viewer-sidebar-list">
          {availableFiles.length === 0 ? (
            <div className="file-viewer-empty-state">No files available</div>
          ) : filteredFiles.length === 0 && fileListSearch ? (
            <div className="file-viewer-empty-state">
              {isSearchingFiles ? 'Searching...' : 'No files contain this text'}
            </div>
          ) : (
            filteredFiles.map((file) => {
              const matchInfo = fileSearchResults.find((result) => result.file === file);
              const isSelected = selectedFile === file;

              return (
                <button
                  key={file}
                  type="button"
                  onClick={() => loadFileContent(file)}
                  className={`file-viewer-file-row${isSelected ? ' selected' : ''}`}
                >
                  <span>{file}</span>
                  {matchInfo && <span className="file-viewer-match-badge">{matchInfo.matches}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="file-viewer-content">
        {selectedFile ? (
          <div className="file-viewer-content-shell">
            <div className="file-viewer-content-header">
              <div>
                <div className="file-viewer-content-title">{selectedFile}</div>
                <div className="file-viewer-content-subtitle">
                  {fileContent.split('\n').length.toLocaleString()} lines
                </div>
              </div>
              <div className="file-viewer-toolbar">
                <div className="file-viewer-search-input-wrapper compact">
                  <input
                    type="text"
                    placeholder="Search in file..."
                    value={fileContentSearch}
                    onChange={(event) => setFileContentSearch(event.target.value)}
                    className="file-viewer-search-input compact"
                  />
                  {fileContentSearch && (
                    <button
                      onClick={() => {
                        setFileContentSearch('');
                        setCurrentMatchIndex(0);
                      }}
                      className="file-viewer-clear-button"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <label className="file-viewer-checkbox-label nowrap">
                  <input
                    type="checkbox"
                    checked={fileContentSearchRegex}
                    onChange={(event) => setFileContentSearchRegex(event.target.checked)}
                  />
                  .*
                </label>
                {contentMatches.length > 0 && (
                  <div className="file-viewer-match-nav">
                    <button onClick={goToPrevMatch} title="Previous match">↑</button>
                    <button onClick={goToNextMatch} title="Next match">↓</button>
                    <div className="file-viewer-helper-text inline">
                      {currentMatchIndex + 1} / {contentMatches.length}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="file-viewer-pre-wrapper">
              {fileContentSearch && contentMatches.length > 0 ? (
                <pre className="file-viewer-pre">
                  <HighlightedContent
                    fileContent={fileContent}
                    contentMatches={contentMatches}
                    currentMatchIndex={currentMatchIndex}
                  />
                </pre>
              ) : (
                <pre className="file-viewer-pre">{fileContent}</pre>
              )}
            </div>
          </div>
        ) : (
          <div className="file-viewer-empty-content">Select a file to view its contents</div>
        )}
      </div>
    </div>
  );
}
