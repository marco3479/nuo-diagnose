import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  countMatches,
  countRegexMatches,
  findContentMatches,
  getFilteredFiles,
  type ContentMatch,
  type FileSearchResult,
} from '../fileSearch';
import type { LoadMode } from '../types';

declare const fetch: any;

type UseFileViewerStateArgs = {
  loadMode: LoadMode;
  mainViewMode: 'timeline' | 'files';
  selectedTicket: string;
  selectedPackage: string;
  selectedServer: string;
};

type UseFileViewerStateResult = {
  availableFiles: string[];
  selectedFile: string | null;
  fileContent: string;
  fileListSearch: string;
  setFileListSearch: (value: string) => void;
  fileContentSearch: string;
  setFileContentSearch: (value: string) => void;
  currentMatchIndex: number;
  setCurrentMatchIndex: (value: number) => void;
  fileSearchResults: FileSearchResult[];
  clearFileSearchResults: () => void;
  isSearchingFiles: boolean;
  fileSearchRegex: boolean;
  setFileSearchRegex: (value: boolean) => void;
  fileContentSearchRegex: boolean;
  setFileContentSearchRegex: (value: boolean) => void;
  contentMatches: ContentMatch[];
  filteredFiles: string[];
  loadFileList: () => Promise<void>;
  loadFileContent: (filename: string) => Promise<void>;
  goToNextMatch: () => void;
  goToPrevMatch: () => void;
};

export function useFileViewerState({
  loadMode,
  mainViewMode,
  selectedTicket,
  selectedPackage,
  selectedServer,
}: UseFileViewerStateArgs): UseFileViewerStateResult {
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

  const loadFileList = useCallback(async () => {
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
  }, [loadMode, selectedPackage, selectedServer, selectedTicket]);

  const searchAcrossFiles = useCallback(async (searchText: string) => {
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
  }, [availableFiles, fileSearchRegex, loadMode, selectedPackage, selectedServer, selectedTicket]);

  const loadFileContent = useCallback(async (filename: string) => {
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
  }, [loadMode, selectedPackage, selectedServer, selectedTicket]);

  const goToNextMatch = useCallback(() => {
    setCurrentMatchIndex((prev) => {
      if (contentMatches.length === 0) {
        return prev;
      }
      return (prev + 1) % contentMatches.length;
    });
  }, [contentMatches.length]);

  const goToPrevMatch = useCallback(() => {
    setCurrentMatchIndex((prev) => {
      if (contentMatches.length === 0) {
        return prev;
      }
      return (prev - 1 + contentMatches.length) % contentMatches.length;
    });
  }, [contentMatches.length]);

  const clearFileSearchResults = useCallback(() => {
    setFileSearchResults([]);
  }, []);

  useEffect(() => {
    if (!fileListSearch || fileListSearch.length < 3) {
      setFileSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchAcrossFiles(fileListSearch);
    }, 500);

    return () => clearTimeout(timer);
  }, [fileListSearch, searchAcrossFiles]);

  useEffect(() => {
    if (!fileContentSearch || !fileContent) {
      setContentMatches([]);
      return;
    }

    const timer = setTimeout(() => {
      const matches = findContentMatches(fileContent, fileContentSearch, fileContentSearchRegex);
      setContentMatches(matches);
      setCurrentMatchIndex(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [fileContent, fileContentSearch, fileContentSearchRegex]);

  useEffect(() => {
    console.log('[useEffect] Checking if should load files:', {
      loadMode,
      selectedServer,
      mainViewMode,
      selectedTicket,
      selectedPackage,
    });
    if (loadMode === 'tickets' && selectedTicket && selectedPackage && selectedServer && mainViewMode === 'files') {
      console.log('[useEffect] Triggering loadFileList');
      loadFileList();
    }
  }, [loadFileList, loadMode, mainViewMode, selectedPackage, selectedServer, selectedTicket]);

  const filteredFiles = useMemo(
    () => getFilteredFiles(availableFiles, fileListSearch, fileSearchResults),
    [availableFiles, fileListSearch, fileSearchResults]
  );

  return {
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
  };
}