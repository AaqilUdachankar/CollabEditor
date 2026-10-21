import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileCode,
  FolderPlus,
  Play,
  Terminal,
  Split,
  Settings,
  UserPlus,
  Save,
  GitBranch,
  X
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { useTerminalStore } from '../../stores/terminalStore.js';

interface PaletteCommand {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setQuickOpenOpen,
    setNewProjectModalOpen,
    setInviteModalOpen,
    setSettingsModalOpen,
  } = useSettingsStore();

  const { currentProject, setActiveActivity } = useProjectStore();
  const { setSplitMode, splitMode, closeAllTabs } = useEditorStore();
  const { togglePanel, openPanel, addOutputLog } = useTerminalStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: PaletteCommand[] = [
    {
      id: 'quick-open',
      title: 'Go to File...',
      category: 'File',
      shortcut: 'Ctrl+P',
      icon: <FileCode size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        setQuickOpenOpen(true);
      },
    },
    {
      id: 'new-project',
      title: 'New Project...',
      category: 'File',
      icon: <FolderPlus size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        setNewProjectModalOpen(true);
      },
    },
    {
      id: 'save-file',
      title: 'Save Active File',
      category: 'File',
      shortcut: 'Ctrl+S',
      icon: <Save size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        addOutputLog('File saved', 'info');
      },
    },
    {
      id: 'toggle-terminal',
      title: 'View: Toggle Integrated Terminal',
      category: 'View',
      shortcut: 'Ctrl+`',
      icon: <Terminal size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        togglePanel();
      },
    },
    {
      id: 'split-editor',
      title: 'View: Toggle Split Editor',
      category: 'View',
      shortcut: 'Ctrl+\\',
      icon: <Split size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        setSplitMode(splitMode === 'none' ? 'vertical' : 'none');
      },
    },
    {
      id: 'run-file',
      title: 'Run: Run Current File',
      category: 'Run',
      shortcut: 'F5',
      icon: <Play size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        openPanel('output');
      },
    },
    {
      id: 'source-control',
      title: 'View: Show Source Control Git',
      category: 'View',
      shortcut: 'Ctrl+Shift+G',
      icon: <GitBranch size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        setActiveActivity('git');
      },
    },
    {
      id: 'invite-collaborator',
      title: 'Collaboration: Invite Collaborators to Project',
      category: 'Collaboration',
      icon: <UserPlus size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        setInviteModalOpen(true);
      },
    },
    {
      id: 'open-settings',
      title: 'Preferences: Open User Settings',
      category: 'Preferences',
      shortcut: 'Ctrl+,',
      icon: <Settings size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        setSettingsModalOpen(true);
      },
    },
    {
      id: 'close-all-tabs',
      title: 'View: Close All Editor Tabs',
      category: 'View',
      icon: <X size={14} />,
      action: () => {
        setCommandPaletteOpen(false);
        closeAllTabs();
      },
    },
  ];

  const filtered = commands.filter((cmd) =>
    `${cmd.category}: ${cmd.title}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Global keydown listeners for Ctrl+Shift+P, Ctrl+P, Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setQuickOpenOpen(true);
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setQuickOpenOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!commandPaletteOpen) return null;

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
        filtered[selectedIndex].action();
      }
    }
  };

  return (
    <div className="palette-overlay" onClick={() => setCommandPaletteOpen(false)}>
      <div className="palette-box" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <Search size={15} color="#007acc" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="palette-results">
          {filtered.map((cmd, idx) => (
            <div
              key={cmd.id}
              className={`palette-item ${idx === selectedIndex ? 'active' : ''}`}
              onClick={cmd.action}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: idx === selectedIndex ? '#38bdf8' : '#858585' }}>
                  {cmd.icon}
                </span>
                <span>{cmd.title}</span>
              </div>
              {cmd.shortcut && (
                <span style={{ fontSize: 11, opacity: 0.6 }}>{cmd.shortcut}</span>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: '12px 16px', color: '#858585', fontSize: 12 }}>
              No matching commands found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
