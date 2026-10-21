import React from 'react';
import { Trash2 } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore.js';

export const OutputTab: React.FC = () => {
  const { outputLogs, clearOutput } = useTerminalStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '4px 8px',
          borderBottom: '1px solid #282828',
        }}
      >
        <button
          onClick={clearOutput}
          className="sidebar-icon-btn"
          title="Clear Output"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          padding: '8px 12px',
          overflowY: 'auto',
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.4,
          backgroundColor: '#181818',
        }}
      >
        {outputLogs.map((log) => {
          let color = '#cccccc';
          if (log.type === 'error') color = '#f87171';
          if (log.type === 'success') color = '#4ade80';

          return (
            <div key={log.id} style={{ display: 'flex', gap: 10, color }}>
              <span style={{ color: '#64748b', fontSize: 11, userSelect: 'none' }}>[{log.time}]</span>
              <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{log.text}</pre>
            </div>
          );
        })}

        {outputLogs.length === 0 && (
          <div style={{ color: '#858585', fontSize: 12 }}>No output yet.</div>
        )}
      </div>
    </div>
  );
};
