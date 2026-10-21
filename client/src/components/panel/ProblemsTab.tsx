import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { useProjectStore } from '../../stores/projectStore.js';

export const ProblemsTab: React.FC = () => {
  const { problems } = useTerminalStore();
  const { files } = useProjectStore();
  const { openTab } = useEditorStore();

  const handleProblemClick = (filePath: string) => {
    const file = files.find((f) => f.path === filePath);
    if (file) openTab(file);
  };

  return (
    <div style={{ padding: '8px 12px', height: '100%', overflowY: 'auto', backgroundColor: '#181818' }}>
      {problems.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#858585', fontSize: 12 }}>
          <CheckCircle2 size={14} color="#22c55e" />
          <span>No problems have been detected in the project workspace.</span>
        </div>
      ) : (
        problems.map((prob, i) => (
          <div
            key={i}
            onClick={() => handleProblemClick(prob.file)}
            className="file-node"
            style={{ padding: '4px 6px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {prob.severity === 'error' && <AlertCircle size={14} color="#f87171" />}
            {prob.severity === 'warning' && <AlertTriangle size={14} color="#facc15" />}
            {prob.severity === 'info' && <Info size={14} color="#38bdf8" />}
            <span style={{ color: 'white' }}>{prob.message}</span>
            <span style={{ color: '#858585', fontSize: 11 }}>[{prob.file}:{prob.line}]</span>
          </div>
        ))
      )}
    </div>
  );
};
