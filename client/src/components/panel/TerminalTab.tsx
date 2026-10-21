import React, { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { createTerminalSession, TerminalInstance } from '../../services/terminalSession.js';

export const TerminalTab: React.FC = () => {
  const { currentProject } = useProjectStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<TerminalInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current || !currentProject) return;

    const session = createTerminalSession(containerRef.current, currentProject.id);
    sessionRef.current = session;

    return () => {
      session.destroy();
      sessionRef.current = null;
    };
  }, [currentProject?.id]);

  if (!currentProject) {
    return (
      <div style={{ padding: 16, color: '#858585', fontSize: 12 }}>
        Select a project to open an interactive terminal session.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', padding: '4px 8px', boxSizing: 'border-box' }}
      />
    </div>
  );
};
