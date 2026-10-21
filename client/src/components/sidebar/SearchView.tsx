import React, { useState } from 'react';
import { Search as SearchIcon, CaseSensitive, WholeWord, Regex, FileCode } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { api } from '../../services/api.js';

export const SearchView: React.FC = () => {
  const { currentProject, files } = useProjectStore();
  const { openTab } = useEditorStore();

  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || !currentProject) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await api.files.search(currentProject.id, query.trim(), {
        matchCase,
        wholeWord,
        isRegex,
      });
      setResults(data.results || []);
    } catch (err) {
      console.error('[Search error]', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (res: any) => {
    const file = files.find((f) => f.id === res.fileId);
    if (file) {
      openTab(file);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span>SEARCH</span>
      </div>

      <div style={{ padding: '8px 12px' }}>
        <form onSubmit={handleSearch}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#2a2a2a',
              border: '1px solid #3c3c3c',
              borderRadius: 3,
              padding: '3px 6px',
            }}
          >
            <input
              type="text"
              placeholder="Search in files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'white',
                fontSize: 12,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                onClick={() => setMatchCase(!matchCase)}
                title="Match Case"
                style={{
                  background: matchCase ? '#007fd4' : 'transparent',
                  border: 'none',
                  color: matchCase ? 'white' : '#858585',
                  padding: '2px 4px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <CaseSensitive size={14} />
              </button>
              <button
                type="button"
                onClick={() => setWholeWord(!wholeWord)}
                title="Match Whole Word"
                style={{
                  background: wholeWord ? '#007fd4' : 'transparent',
                  border: 'none',
                  color: wholeWord ? 'white' : '#858585',
                  padding: '2px 4px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <WholeWord size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsRegex(!isRegex)}
                title="Use Regular Expression"
                style={{
                  background: isRegex ? '#007fd4' : 'transparent',
                  border: 'none',
                  color: isRegex ? 'white' : '#858585',
                  padding: '2px 4px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <Regex size={14} />
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="sidebar-content" style={{ padding: '0 8px' }}>
        {isSearching && (
          <div style={{ padding: 12, color: '#858585', fontSize: 12 }}>Searching...</div>
        )}

        {!isSearching && results.length > 0 && (
          <div>
            <div style={{ padding: '4px 6px', fontSize: 11, color: '#858585' }}>
              {results.length} {results.length === 1 ? 'result' : 'results'} found
            </div>
            {results.map((res, i) => (
              <div
                key={i}
                onClick={() => handleResultClick(res)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  marginBottom: 2,
                  fontSize: 12,
                }}
                className="file-node"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: '#38bdf8' }}>
                  <FileCode size={13} />
                  <span>{res.fileName}</span>
                  <span style={{ fontSize: 10, color: '#858585' }}>:{res.lineNumber}</span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingLeft: 18,
                  }}
                >
                  {res.lineContent}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isSearching && query && results.length === 0 && (
          <div style={{ padding: 12, color: '#858585', fontSize: 12 }}>No results found.</div>
        )}
      </div>
    </div>
  );
};
