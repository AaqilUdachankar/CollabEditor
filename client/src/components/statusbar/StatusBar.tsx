import React from 'react';
import {
  GitBranch,
  CloudCheck,
  AlertCircle,
  AlertTriangle,
  Users,
  Terminal,
  Radio
} from 'lucide-react';
import { useGitStore } from '../../stores/gitStore.js';
import { useCollaborationStore } from '../../stores/collaborationStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useTerminalStore } from '../../stores/terminalStore.js';

export const StatusBar: React.FC = () => {
  const { status } = useGitStore();
  const { collaborators, isConnected } = useCollaborationStore();
  const { tabs, activeTabId } = useEditorStore();
  const { files, setActiveActivity } = useProjectStore();
  const { openPanel, problems } = useTerminalStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeFile = files.find((f) => f.id === activeTab?.fileId);

  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const warningCount = problems.filter((p) => p.severity === 'warning').length;

  return (
    <footer className="nexus-statusbar" role="status">
      {/* Left items */}
      <div className="statusbar-left">
        {/* Branch */}
        <div
          className="statusbar-item"
          onClick={() => setActiveActivity('git')}
          title="Git Branch (Click to open Source Control)"
        >
          <GitBranch size={12} />
          <span>{status?.branch || 'main'}</span>
        </div>

        {/* Sync state */}
        <div className="statusbar-item" title="Connected to Nexus Cloud CRDT Sync Server">
          <CloudCheck size={13} />
          <span>Sync</span>
        </div>

        {/* Errors & Warnings */}
        <div
          className="statusbar-item"
          onClick={() => openPanel('problems')}
          title={`${errorCount} errors, ${warningCount} warnings`}
        >
          <AlertCircle size={12} />
          <span>{errorCount}</span>
          <AlertTriangle size={12} style={{ marginLeft: 4 }} />
          <span>{warningCount}</span>
        </div>
      </div>

      {/* Right items */}
      <div className="statusbar-right">
        {/* Line & Column */}
        <div className="statusbar-item" title="Current Cursor Line & Column">
          <span>Ln 1, Col 1</span>
        </div>

        {/* Spaces Indentation */}
        <div className="statusbar-item" title="Indentation Settings">
          <span>Spaces: 2</span>
        </div>

        {/* Encoding */}
        <div className="statusbar-item" title="File Encoding">
          <span>UTF-8</span>
        </div>

        {/* Language */}
        <div className="statusbar-item" title="Language Mode">
          <span>{activeFile?.language ? activeFile.language.toUpperCase() : 'PLAINTEXT'}</span>
        </div>

        {/* Collaborators badge */}
        <div
          className="statusbar-item"
          onClick={() => setActiveActivity('collab')}
          style={{ backgroundColor: collaborators.length > 0 ? '#10b98133' : 'transparent' }}
          title={`${collaborators.length} collaborators in session`}
        >
          <Radio size={12} color={isConnected ? '#4ade80' : '#f87171'} />
          <Users size={12} />
          <span>{collaborators.length} Active</span>
        </div>
      </div>
    </footer>
  );
};
