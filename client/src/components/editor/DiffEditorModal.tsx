import React from 'react';
import { X, FileDiff } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore.js';

export const DiffEditorModal: React.FC = () => {
  const { activeDiff, closeDiff } = useGitStore();

  if (!activeDiff) return null;

  return (
    <div className="palette-overlay" onClick={closeDiff}>
      <div
        className="palette-box"
        style={{ width: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #3c3c3c',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
            <FileDiff size={16} color="#38bdf8" />
            <span>Git Diff: {activeDiff.file}</span>
          </div>
          <button
            onClick={closeDiff}
            style={{ background: 'transparent', border: 'none', color: '#858585', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', backgroundColor: '#1e1e1e' }}>
          <pre
            style={{
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              fontSize: 12,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              color: '#cccccc',
            }}
          >
            {activeDiff.diffText ? (
              activeDiff.diffText.split('\n').map((line, idx) => {
                let color = '#cccccc';
                let bg = 'transparent';
                if (line.startsWith('+')) {
                  color = '#4ade80';
                  bg = 'rgba(74, 222, 128, 0.1)';
                } else if (line.startsWith('-')) {
                  color = '#f87171';
                  bg = 'rgba(248, 113, 113, 0.1)';
                } else if (line.startsWith('@')) {
                  color = '#38bdf8';
                }
                return (
                  <div key={idx} style={{ color, backgroundColor: bg, padding: '1px 4px' }}>
                    {line}
                  </div>
                );
              })
            ) : (
              <div style={{ color: '#858585' }}>No differences found.</div>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
};
