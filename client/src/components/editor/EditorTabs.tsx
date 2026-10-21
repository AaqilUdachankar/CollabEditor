import React from 'react';
import { X, Split, SplitSquareVertical, FileCode, Code, FileText, FileJson, File } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore.js';
import { ITab } from '../../types/ide.js';

interface EditorTabsProps {
  isSplit?: boolean;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({ isSplit = false }) => {
  const {
    tabs,
    activeTabId,
    splitTabs,
    activeSplitTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    setSplitMode,
    splitMode,
    setActiveSplitTab,
    closeSplitTab,
  } = useEditorStore();

  const currentTabs = isSplit ? splitTabs : tabs;
  const currentActiveId = isSplit ? activeSplitTabId : activeTabId;

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return <FileCode size={13} color="#eab308" />;
      case 'ts':
      case 'tsx':
        return <FileCode size={13} color="#3b82f6" />;
      case 'html':
        return <Code size={13} color="#f97316" />;
      case 'css':
      case 'scss':
        return <Code size={13} color="#06b6d4" />;
      case 'json':
        return <FileJson size={13} color="#eab308" />;
      case 'py':
        return <FileCode size={13} color="#10b981" />;
      case 'cpp':
      case 'c':
        return <FileCode size={13} color="#6366f1" />;
      default:
        return <FileText size={13} color="#94a3b8" />;
    }
  };

  return (
    <div className="editor-tabs-bar">
      <div style={{ display: 'flex', flex: 1, overflowX: 'auto', height: '100%' }}>
        {currentTabs.map((tab) => {
          const isActive = tab.id === currentActiveId;
          return (
            <div
              key={tab.id}
              className={`editor-tab ${isActive ? 'active' : ''}`}
              onClick={() => (isSplit ? setActiveSplitTab(tab.id) : setActiveTab(tab.id))}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  // Middle click closes tab
                  isSplit ? closeSplitTab(tab.id) : closeTab(tab.id);
                }
              }}
            >
              {getFileIcon(tab.title)}
              <span>{tab.title}</span>

              {tab.isDirty ? (
                <div className="tab-dirty-dot" title="Unsaved changes" />
              ) : (
                <button
                  className="tab-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    isSplit ? closeSplitTab(tab.id) : closeTab(tab.id);
                  }}
                  title="Close (Ctrl+W)"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Editor Actions on right */}
      {!isSplit && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4 }}>
          <button
            className="sidebar-icon-btn"
            title="Split Editor Right (Ctrl+\)"
            onClick={() => {
              setSplitMode(splitMode === 'vertical' ? 'none' : 'vertical');
            }}
          >
            <Split size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
