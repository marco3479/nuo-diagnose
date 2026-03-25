export type FileSearchResult = {
  file: string;
  matches: number;
};

export type ContentMatch = {
  index: number;
  length: number;
};

export function getFilteredFiles(
  availableFiles: string[],
  fileListSearch: string,
  fileSearchResults: FileSearchResult[]
): string[] {
  if (fileListSearch && fileSearchResults.length > 0) {
    return fileSearchResults.map((result) => result.file);
  }

  if (fileListSearch) {
    return [];
  }

  return availableFiles;
}

export function countMatches(content: string, searchText: string): number {
  if (!searchText) {
    return 0;
  }

  const searchLower = searchText.toLowerCase();
  const contentLower = content.toLowerCase();
  let matchCount = 0;
  let index = 0;

  while ((index = contentLower.indexOf(searchLower, index)) !== -1) {
    matchCount += 1;
    index += searchLower.length;
  }

  return matchCount;
}

export function countRegexMatches(content: string, searchText: string): number {
  try {
    const regex = new RegExp(searchText, 'gi');
    const matches = content.match(regex);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

export function findContentMatches(
  content: string,
  searchText: string,
  useRegex: boolean
): ContentMatch[] {
  if (!content || !searchText) {
    return [];
  }

  const matches: ContentMatch[] = [];

  if (useRegex) {
    try {
      const regex = new RegExp(searchText, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        matches.push({ index: match.index, length: match[0].length });
        if (match[0].length === 0) {
          regex.lastIndex += 1;
        }
      }
      return matches;
    } catch {
      return [];
    }
  }

  const searchLower = searchText.toLowerCase();
  const contentLower = content.toLowerCase();
  let index = 0;
  while ((index = contentLower.indexOf(searchLower, index)) !== -1) {
    matches.push({ index, length: searchText.length });
    index += searchText.length;
  }

  return matches;
}
