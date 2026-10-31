import React, { useRef, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore.js';
import { ExplorerView } from './ExplorerView.js';
import { SearchView } from './SearchView.js';
import { SourceControlView } from './SourceControlView.js';
import { RunDebugView } from './RunDebugView.js';
import { ExtensionsView } from './ExtensionsView.js';
import { CollaboratorsView } from './CollaboratorsView.js';

export const SidebarContainer: React.FC = () => {
  const { activeActivity, sidebarWidth, setSidebarWidth } = useProjectStore();
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setSidebarWidth(startWidth + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (activeActivity === 'admin') {
    return null;
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div
        className="nexus-sidebar"
        style={{ width: `${sidebarWidth}px`, flexShrink: 0 }}
      >
        {activeActivity === 'explorer' && <ExplorerView />}
        {activeActivity === 'search' && <SearchView />}
        {activeActivity === 'git' && <SourceControlView />}
        {activeActivity === 'debug' && <RunDebugView />}
        {activeActivity === 'extensions' && <ExtensionsView />}
        {activeActivity === 'collab' && <CollaboratorsView />}
      </div>

      <div
        className={`resizer-horizontal ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};
