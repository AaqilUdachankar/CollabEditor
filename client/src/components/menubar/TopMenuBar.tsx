import React, { useState, useRef, useEffect } from 'react';
import {
  Code2,
  Search,
  UserPlus,
  Play,
  Terminal,
  Settings,
  Users,
  LogOut,
  FolderOpen,
  Save,
  Split,
  Eye,
  Check,
  Circle
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { useTerminalStore } from '../../stores/terminalStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useCollaborationStore } from '../../stores/collaborationStore.js';
import { api } from '../../services/api.js';

export const TopMenuBar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { currentProject, projects, selectProject, saveFile, setActiveActivity } = useProjectStore();
  const { tabs, activeTabId, setSplitMode, splitMode } = useEditorStore();
  const { togglePanel, openPanel, addOutputLog } = useTerminalStore();
  const {
    setCommandPaletteOpen,
    setQuickOpenOpen,
    setNewProjectModalOpen,
    setInviteModalOpen,
    setSettingsModalOpen,
    setAuthModalOpen,
  } = useSettingsStore();
  const { collaborators } = useCollaborationStore();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRunCurrentFile = async () => {
    if (!currentProject) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) {
      openPanel('output');
      addOutputLog('No active file to run. Open a runnable file (.js, .py, .cpp, .c, .java).', 'error');
      return;
    }

    setIsRunning(true);
    openPanel('output');
    addOutputLog(`[Running ${activeTab.title}...]`, 'info');

    try {
      // 1. Get latest content from active Monaco instance if open
      let content: string | undefined;
      if (typeof (window as any).__collabide_get_active_content === 'function') {
        content = (window as any).__collabide_get_active_content();
      }

      // 2. Flush file to backend store
      if (typeof (window as any).__collabide_save_active === 'function') {
        await (window as any).__collabide_save_active();
      } else if (content !== undefined) {
        await saveFile(activeTab.fileId, content);
      }

      const res = await api.execution.runFile(currentProject.id, activeTab.fileId, content);
      if (res.stdout) addOutputLog(res.stdout, 'info');
      if (res.stderr) addOutputLog(res.stderr, 'error');
      addOutputLog(`[Process exited with code ${res.exitCode} in ${res.durationMs}ms]`, res.exitCode === 0 ? 'success' : 'error');
    } catch (err: any) {
      addOutputLog(`Execution error: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveActive = async () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && currentProject) {
      if (typeof (window as any).__collabide_save_active === 'function') {
        await (window as any).__collabide_save_active();
      }
      addOutputLog(`Saved ${activeTab.title}`, 'info');
    }
  };

  return (
    <header className="nexus-topbar" ref={menuBarRef}>
      {/* Left: Branding & Menus */}
      <div className="nexus-topbar-left">
        <div className="nexus-logo" title="CollabIDE - Collaborative IDE">
          <Code2 size={18} />
          <span>CollabIDE</span>
        </div>

        <nav className="nexus-menu-container">
          {/* File Menu */}
          <div className="menu-item-wrapper" style={{ position: 'relative' }}>
            <button
              className={`nexus-menu-btn ${activeMenu === 'file' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className="menu-dropdown">
                <div className="menu-dropdown-item" onClick={() => { setNewProjectModalOpen(true); setActiveMenu(null); }}>
                  <span>New Project...</span>
                </div>
                <div className="menu-dropdown-item" onClick={() => { setQuickOpenOpen(true); setActiveMenu(null); }}>
                  <span>Open File...</span>
                  <span className="menu-shortcut">Ctrl+P</span>
                </div>
                <div className="menu-separator" />
                <div className="menu-dropdown-item" onClick={() => { handleSaveActive(); setActiveMenu(null); }}>
                  <span>Save</span>
                  <span className="menu-shortcut">Ctrl+S</span>
                </div>
                <div className="menu-dropdown-item" onClick={() => { setActiveMenu(null); }}>
                  <span>Save All</span>
                </div>
                <div className="menu-separator" />
                <div className="menu-dropdown-item" onClick={() => { setSettingsModalOpen(true); setActiveMenu(null); }}>
                  <span>Preferences: Settings</span>
                </div>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="menu-item-wrapper" style={{ position: 'relative' }}>
            <button
              className={`nexus-menu-btn ${activeMenu === 'edit' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div className="menu-dropdown">
                <div className="menu-dropdown-item" onClick={() => { setCommandPaletteOpen(true); setActiveMenu(null); }}>
                  <span>Command Palette...</span>
                  <span className="menu-shortcut">Ctrl+Shift+P</span>
                </div>
                <div className="menu-dropdown-item" onClick={() => { setActiveActivity('search'); setActiveMenu(null); }}>
                  <span>Find in Files</span>
                  <span className="menu-shortcut">Ctrl+Shift+F</span>
                </div>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="menu-item-wrapper" style={{ position: 'relative' }}>
            <button
              className={`nexus-menu-btn ${activeMenu === 'view' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div className="menu-dropdown">
                <div className="menu-dropdown-item" onClick={() => { togglePanel(); setActiveMenu(null); }}>
                  <span>Toggle Terminal / Panel</span>
                  <span className="menu-shortcut">Ctrl+`</span>
                </div>
                <div className="menu-dropdown-item" onClick={() => {
                  setSplitMode(splitMode === 'none' ? 'vertical' : 'none');
                  setActiveMenu(null);
                }}>
                  <span>Toggle Split Editor</span>
                </div>
              </div>
            )}
          </div>

          {/* Run Menu */}
          <div className="menu-item-wrapper" style={{ position: 'relative' }}>
            <button
              className={`nexus-menu-btn ${activeMenu === 'run' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'run' ? null : 'run')}
            >
              Run
            </button>
            {activeMenu === 'run' && (
              <div className="menu-dropdown">
                <div className="menu-dropdown-item" onClick={() => { handleRunCurrentFile(); setActiveMenu(null); }}>
                  <span>Run Current File</span>
                  <span className="menu-shortcut">F5</span>
                </div>
              </div>
            )}
          </div>

          {/* Terminal Menu */}
          <div className="menu-item-wrapper" style={{ position: 'relative' }}>
            <button
              className={`nexus-menu-btn ${activeMenu === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'terminal' ? null : 'terminal')}
            >
              Terminal
            </button>
            {activeMenu === 'terminal' && (
              <div className="menu-dropdown">
                <div className="menu-dropdown-item" onClick={() => { openPanel('terminal'); setActiveMenu(null); }}>
                  <span>New Integrated Terminal</span>
                  <span className="menu-shortcut">Ctrl+Shift+`</span>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="nexus-topbar-center">
        <button
          className="nexus-quick-open-btn"
          onClick={() => setCommandPaletteOpen(true)}
          title="Search files and commands (Ctrl+P or Ctrl+Shift+P)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={13} />
            <span>{currentProject ? `${currentProject.name}` : 'Nexus Studio'}</span>
          </div>
          <span style={{ fontSize: 11, opacity: 0.6 }}>Ctrl+P</span>
        </button>
      </div>

      {/* Right: Actions, Collaboration, Profile */}
      <div className="nexus-topbar-right">
        {/* Run File Quick Action */}
        <button
          className="icon-btn-highlight"
          onClick={handleRunCurrentFile}
          disabled={isRunning || !currentProject}
          title="Run current file (F5)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: '#16a34a',
            color: 'white',
            border: 'none',
            padding: '3px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <Play size={12} fill="white" />
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </button>

        {/* Live Collaborators Presence Avatars */}
        {collaborators.length > 0 && (
          <div className="collaborator-avatars" title={`${collaborators.length} collaborators online`}>
            {collaborators.slice(0, 4).map((c) => (
              <div
                key={c.socketId}
                className="collab-avatar-badge"
                style={{ backgroundColor: c.avatarColor }}
                title={`${c.username} (${c.activeFilePath || 'Browsing'})`}
              >
                {c.username.substring(0, 2).toUpperCase()}
              </div>
            ))}
            {collaborators.length > 4 && (
              <div className="collab-avatar-badge" style={{ backgroundColor: '#475569' }}>
                +{collaborators.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Invite Button */}
        {currentProject && (
          <button
            className="action-btn-sm"
            onClick={() => setInviteModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#0284c7',
              color: 'white',
              border: 'none',
              padding: '3px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <UserPlus size={13} />
            <span>Invite</span>
          </button>
        )}

        {/* User Profile / Auth Button */}
        {isAuthenticated && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: user.avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: 11,
              }}
              title={`Logged in as ${user.username} (${user.email})`}
            >
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <button
              onClick={() => logout()}
              title="Sign out"
              style={{ background: 'transparent', border: 'none', color: '#858585', cursor: 'pointer', display: 'flex' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '3px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Sign In
          </button>
        )}
      </div>

      <style>{`
        .menu-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          background: #1f1f1f;
          border: 1px solid #3c3c3c;
          border-radius: 4px;
          min-width: 190px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          padding: 4px 0;
          z-index: 1000;
        }
        .menu-dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 12px;
          font-size: 12px;
          color: #cccccc;
          cursor: pointer;
        }
        .menu-dropdown-item:hover {
          background-color: #04395e;
          color: white;
        }
        .menu-shortcut {
          font-size: 11px;
          color: #858585;
        }
        .menu-separator {
          height: 1px;
          background: #3c3c3c;
          margin: 4px 0;
        }
      `}</style>
    </header>
  );
};
