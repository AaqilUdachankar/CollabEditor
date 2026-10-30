import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search as SearchIcon,
  CaseSensitive,
  WholeWord,
  Regex,
  FileCode,
  Folder,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  ChevronsDownUp,
  ChevronsUpDown,
  RotateCw,
  Lock,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { api } from '../../services/api.js';
import { ISearchResult, IFileNode } from '../../types/ide.js';

interface FileGroup {
  fileId: string;
  filePath: string;
  fileName: string;
  fileNode?: IFileNode;
  matches: ISearchResult[];
}

export const SearchView: React.FC = () => {
  const { currentProject, files } = useProjectStore();
  const { navigateToLocation, openTab } = useEditorStore();

  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [results, setResults] = useState<ISearchResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  const debounceTimerRef = useRef<any>(null);
  const searchAbortRef = useRef<boolean>(false);

  // Perform search across files
  const executeSearch = async (searchTerm: string) => {
    if (!searchTerm.trim() || !currentProject) {
      setResults([]);
      setTotalMatches(0);
      setHasMore(false);
      setIsSearching(false);
      setSearchError(null);
      setIsForbidden(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setIsForbidden(false);

    try {
      const data = await api.files.search(currentProject.id, searchTerm.trim(), {
        matchCase,
        wholeWord,
        isRegex,
        limit: 200,
      });

      if (!searchAbortRef.current) {
        setResults(data.results || []);
        setTotalMatches(data.totalMatches !== undefined ? data.totalMatches : (data.results || []).length);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (err: any) {
      console.error('[Search error]', err);
      if (err?.message?.includes('403') || err?.status === 403) {
        setIsForbidden(true);
        setSearchError('Viewer access or above is required to search this workspace.');
      } else {
        setSearchError(err?.message || 'Search failed. Please try again.');
      }
      setResults([]);
      setTotalMatches(0);
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search on query or option toggle changes (300ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setTotalMatches(0);
      setHasMore(false);
      setIsSearching(false);
      setSearchError(null);
      setIsForbidden(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(query);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, matchCase, wholeWord, isRegex, currentProject?.id]);

  // Group search results by file
  const fileGroups: FileGroup[] = useMemo(() => {
    const map = new Map<string, FileGroup>();

    for (const res of results) {
      let group = map.get(res.fileId);
      if (!group) {
        const fileNode = files.find((f) => f.id === res.fileId);
        group = {
          fileId: res.fileId,
          filePath: res.filePath,
          fileName: res.fileName,
          fileNode,
          matches: [],
        };
        map.set(res.fileId, group);
      }
      group.matches.push(res);
    }

    return Array.from(map.values());
  }, [results, files]);

  const toggleFileCollapse = (fileId: string) => {
    setCollapsedFiles((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const group of fileGroups) {
      next[group.fileId] = true;
    }
    setCollapsedFiles(next);
  };

  const expandAll = () => {
    setCollapsedFiles({});
  };

  const handleResultClick = (group: FileGroup, match: ISearchResult) => {
    const targetFile = group.fileNode || files.find((f) => f.id === group.fileId);
    if (!targetFile) return;

    navigateToLocation(
      targetFile,
      match.lineNumber,
      match.matchStart,
      match.matchEnd,
      match.colStart,
      match.colEnd
    );
  };

  const handleFileHeaderClick = (group: FileGroup) => {
    const targetFile = group.fileNode || files.find((f) => f.id === group.fileId);
    if (targetFile) {
      openTab(targetFile);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setTotalMatches(0);
    setHasMore(false);
    setSearchError(null);
  };

  // Helper to render matching line snippet with highlighted match
  const renderSnippet = (match: ISearchResult) => {
    const text = match.lineContent;
    const start = match.matchStart;
    const end = match.matchEnd;

    if (start >= 0 && end > start && start < text.length) {
      const before = text.slice(0, start);
      const highlighted = text.slice(start, end);
      const after = text.slice(end);

      return (
        <span style={{ fontFamily: 'var(--vsc-font-code, monospace)' }}>
          <span>{before}</span>
          <span
            style={{
              backgroundColor: 'rgba(234, 179, 8, 0.35)',
              color: '#fef08a',
              borderRadius: 2,
              padding: '0 2px',
              fontWeight: 600,
            }}
          >
            {highlighted}
          </span>
          <span>{after}</span>
        </span>
      );
    }

    return <span style={{ fontFamily: 'var(--vsc-font-code, monospace)' }}>{text}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--vsc-bg-sidebar, #1e1e1e)' }}>
      {/* Sidebar Header */}
      <div
        className="sidebar-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--vsc-border, #282828)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'var(--vsc-text-muted, #858585)',
        }}
      >
        <span>SEARCH</span>
        {results.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={Object.keys(collapsedFiles).length > 0 ? expandAll : collapseAll}
              title={Object.keys(collapsedFiles).length > 0 ? 'Expand All' : 'Collapse All'}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--vsc-text-muted, #858585)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 3,
                display: 'flex',
              }}
            >
              {Object.keys(collapsedFiles).length > 0 ? (
                <ChevronsUpDown size={14} />
              ) : (
                <ChevronsDownUp size={14} />
              )}
            </button>
            <button
              type="button"
              onClick={() => executeSearch(query)}
              title="Refresh Search"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--vsc-text-muted, #858585)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 3,
                display: 'flex',
              }}
            >
              <RotateCw size={14} />
            </button>
            <button
              type="button"
              onClick={clearSearch}
              title="Clear Search"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--vsc-text-muted, #858585)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 3,
                display: 'flex',
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Search Input and Toggles */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--vsc-border-subtle, #222222)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--vsc-input-bg, #2a2a2a)',
            border: '1px solid var(--vsc-input-border, #3c3c3c)',
            borderRadius: 4,
            padding: '3px 6px',
            gap: 4,
          }}
        >
          <SearchIcon size={14} style={{ color: 'var(--vsc-text-muted, #858585)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search in files and names..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                executeSearch(query);
              }
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--vsc-text-bright, #ffffff)',
              fontSize: 12,
              minWidth: 0,
            }}
          />

          {query && (
            <button
              type="button"
              onClick={clearSearch}
              title="Clear Input"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--vsc-text-muted, #858585)',
                padding: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              onClick={() => setMatchCase(!matchCase)}
              title="Match Case (Aa)"
              style={{
                background: matchCase ? 'var(--vsc-border-active, #007fd4)' : 'transparent',
                border: 'none',
                color: matchCase ? '#ffffff' : 'var(--vsc-text-muted, #858585)',
                padding: '2px 4px',
                borderRadius: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <CaseSensitive size={14} />
            </button>

            <button
              type="button"
              onClick={() => setWholeWord(!wholeWord)}
              title="Match Whole Word (\b)"
              style={{
                background: wholeWord ? 'var(--vsc-border-active, #007fd4)' : 'transparent',
                border: 'none',
                color: wholeWord ? '#ffffff' : 'var(--vsc-text-muted, #858585)',
                padding: '2px 4px',
                borderRadius: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <WholeWord size={14} />
            </button>

            <button
              type="button"
              onClick={() => setIsRegex(!isRegex)}
              title="Use Regular Expression (.*)"
              style={{
                background: isRegex ? 'var(--vsc-border-active, #007fd4)' : 'transparent',
                border: 'none',
                color: isRegex ? '#ffffff' : 'var(--vsc-text-muted, #858585)',
                padding: '2px 4px',
                borderRadius: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Regex size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Results Content Area */}
      <div
        className="sidebar-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '6px 8px',
        }}
      >
        {/* Loading State */}
        {isSearching && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 6px',
              color: 'var(--vsc-text-muted, #858585)',
              fontSize: 12,
            }}
          >
            <Loader2 size={15} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Searching workspace files...</span>
          </div>
        )}

        {/* Permission Denied State */}
        {!isSearching && isForbidden && (
          <div
            style={{
              padding: '12px',
              borderRadius: 4,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              margin: '8px 0',
            }}
          >
            <Lock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Access Denied</div>
              <div>Viewer permission or above is required to search this workspace.</div>
            </div>
          </div>
        )}

        {/* Other Error State */}
        {!isSearching && !isForbidden && searchError && (
          <div
            style={{
              padding: '12px',
              borderRadius: 4,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              margin: '8px 0',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Search Error</div>
              <div>{searchError}</div>
              <button
                type="button"
                onClick={() => executeSearch(query)}
                style={{
                  marginTop: 6,
                  padding: '3px 8px',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: 3,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty Query State */}
        {!isSearching && !query.trim() && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--vsc-text-muted, #858585)',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <SearchIcon size={28} style={{ opacity: 0.3 }} />
            <div>Search across file names and code in this project workspace.</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              Shortcut: <kbd style={{ background: '#2d2d2d', padding: '1px 5px', borderRadius: 3 }}>Ctrl+Shift+F</kbd>
            </div>
          </div>
        )}

        {/* No Results Found */}
        {!isSearching && query.trim() && !searchError && results.length === 0 && (
          <div
            style={{
              padding: '20px 12px',
              textAlign: 'center',
              color: 'var(--vsc-text-muted, #858585)',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ color: 'var(--vsc-text-main, #cccccc)', fontWeight: 500 }}>
              No results found for &quot;{query}&quot;
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
              Try adjusting your spelling or toggle Match Case / Whole Word options.
            </div>
          </div>
        )}

        {/* Results List */}
        {!isSearching && results.length > 0 && (
          <div>
            {/* Match Count Summary */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px 8px 6px',
                fontSize: 11,
                color: 'var(--vsc-text-muted, #858585)',
                borderBottom: '1px solid var(--vsc-border-subtle, #222222)',
                marginBottom: 6,
              }}
            >
              <span>
                <strong>{totalMatches}</strong> {totalMatches === 1 ? 'match' : 'matches'} in{' '}
                <strong>{fileGroups.length}</strong> {fileGroups.length === 1 ? 'file' : 'files'}
                {hasMore && ' (capped at 200)'}
              </span>
            </div>

            {/* Grouped by File */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {fileGroups.map((group) => {
                const isCollapsed = Boolean(collapsedFiles[group.fileId]);
                const dirPath = group.filePath.includes('/')
                  ? group.filePath.slice(0, group.filePath.lastIndexOf('/'))
                  : '';

                return (
                  <div
                    key={group.fileId}
                    style={{
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    {/* File Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 6px',
                        cursor: 'pointer',
                        fontSize: 12,
                        borderRadius: 3,
                        color: 'var(--vsc-text-bright, #ffffff)',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      }}
                      className="file-node"
                      onClick={() => toggleFileCollapse(group.fileId)}
                      onDoubleClick={() => handleFileHeaderClick(group)}
                    >
                      <button
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--vsc-text-muted, #858585)',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                        }}
                      >
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      </button>

                      <FileCode size={13} style={{ color: '#38bdf8', flexShrink: 0 }} />

                      <span style={{ fontWeight: 600, flexShrink: 0 }}>{group.fileName}</span>

                      {dirPath && (
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--vsc-text-subtle, #5a5a5a)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dirPath}
                        </span>
                      )}

                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 8,
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {group.matches.length}
                      </span>
                    </div>

                    {/* File Matches */}
                    {!isCollapsed && (
                      <div style={{ paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                        {group.matches.map((match, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleResultClick(group, match)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 6px',
                              borderRadius: 3,
                              cursor: 'pointer',
                              fontSize: 11,
                              color: 'var(--vsc-text-main, #cccccc)',
                            }}
                            className="file-node"
                            title={`Line ${match.lineNumber}: ${match.lineContent}`}
                          >
                            <span
                              style={{
                                color: 'var(--vsc-text-muted, #858585)',
                                fontSize: 10,
                                minWidth: 26,
                                textAlign: 'right',
                                fontFamily: 'var(--vsc-font-code, monospace)',
                                flexShrink: 0,
                              }}
                            >
                              {match.lineNumber}:
                            </span>

                            <div
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                              }}
                            >
                              {renderSnippet(match)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
