import React, { useState } from 'react';
import { X, Maximize2, Minimize2, Terminal, FileText, AlertCircle, Play } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore.js';
import { TerminalTab } from './TerminalTab.js';
import { OutputTab } from './OutputTab.js';
import { ProblemsTab } from './ProblemsTab.js';

export const BottomPanel: React.FC = () => {
  const {
    isOpen,
    activeTab,
    height,
    setActiveTab,
    closePanel,
    setHeight,
    problems,
  } = useTerminalStore();

  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      setHeight(startHeight + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="nexus-bottom-panel"
      style={{
        height: isMaximized ? 'calc(100vh - 70px)' : `${height}px`,
        position: isMaximized ? 'absolute' : 'relative',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: isMaximized ? 200 : 30,
      }}
    >
      {/* Top Draggable Resizer */}
      {!isMaximized && (
        <div
          className={`resizer-vertical ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleMouseDown}
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        />
      )}

      {/* Panel Tab Header */}
      <div className="panel-header">
        <div className="panel-tabs">
          <button
            className={`panel-tab-btn ${activeTab === 'problems' ? 'active' : ''}`}
            onClick={() => setActiveTab('problems')}
          >
            <span>PROBLEMS</span>
            {problems.length > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: 8,
                  padding: '1px 5px',
                  fontSize: 10,
                }}
              >
                {problems.length}
              </span>
            )}
          </button>

          <button
            className={`panel-tab-btn ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            <span>OUTPUT</span>
          </button>

          <button
            className={`panel-tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            <span>TERMINAL</span>
          </button>
        </div>

        {/* Panel Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="sidebar-icon-btn"
            title={isMaximized ? 'Restore Panel Size' : 'Maximize Panel'}
            onClick={() => setIsMaximized(!isMaximized)}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            className="sidebar-icon-btn"
            title="Close Panel (Ctrl+`)"
            onClick={closePanel}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Panel Tab Content */}
      <div className="panel-content" style={{ width: '100%', height: 'calc(100% - 35px)', position: 'relative' }}>
        <div style={{ width: '100%', height: '100%', display: activeTab === 'terminal' ? 'block' : 'none' }}>
          <TerminalTab />
        </div>
        <div style={{ width: '100%', height: '100%', display: activeTab === 'output' ? 'block' : 'none' }}>
          <OutputTab />
        </div>
        <div style={{ width: '100%', height: '100%', display: activeTab === 'problems' ? 'block' : 'none' }}>
          <ProblemsTab />
        </div>
      </div>
    </div>
  );
};
