import React from 'react';
import { ChevronRight, Folder, FileCode } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';

interface BreadcrumbsProps {
  isSplit?: boolean;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ isSplit = false }) => {
  const { currentProject } = useProjectStore();
  const { tabs, activeTabId, splitTabs, activeSplitTabId } = useEditorStore();

  const currentTabs = isSplit ? splitTabs : tabs;
  const currentActiveId = isSplit ? activeSplitTabId : activeTabId;
  const activeTab = currentTabs.find((t) => t.id === currentActiveId);

  if (!activeTab || !currentProject) return null;

  const parts = activeTab.path.split('/');

  return (
    <div className="nexus-breadcrumbs">
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Folder size={12} color="#eab308" />
        <span>{currentProject.name}</span>
      </span>

      {parts.map((part, index) => {
        const isLast = index === parts.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight size={11} color="#64748b" />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isLast ? '#e2e8f0' : '#94a3b8' }}>
              {isLast && <FileCode size={12} color="#38bdf8" />}
              <span>{part}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
