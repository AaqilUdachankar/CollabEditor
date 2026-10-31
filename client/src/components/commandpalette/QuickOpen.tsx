import { LanguageIcon } from '../common/LanguageIcon.js';
import React, { useState, useEffect, useRef } from 'react';
import { Search, FileCode, FileText } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { IFileNode } from '../../types/ide.js';

export const QuickOpen: React.FC = () => {
  const { quickOpenOpen, setQuickOpenOpen } = useSettingsStore();
  const { files } = useProjectStore();
  const { openTab } = useEditorStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const runnableFiles = files.filter((f) => f.type === 'file');
  const filtered = runnableFiles.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.path.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (quickOpenOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [quickOpenOpen]);

  if (!quickOpenOpen) return null;

  const handleSelect = (file: IFileNode) => {
    openTab(file);
    setQuickOpenOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  };

  return (
    <div className="palette-overlay" onClick={() => setQuickOpenOpen(false)}>
      <div className="palette-box" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <Search size={15} color="#007acc" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Search files by name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="palette-results">
          {filtered.map((file, idx) => (
            <div
              key={file.id}
              className={`palette-item ${idx === selectedIndex ? 'active' : ''}`}
              onClick={() => handleSelect(file)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LanguageIcon filename={file.name} size={14} />
                <span>{file.name}</span>
                <span style={{ fontSize: 11, color: '#858585' }}>{file.path}</span>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: '12px 16px', color: '#858585', fontSize: 12 }}>
              No matching files found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
