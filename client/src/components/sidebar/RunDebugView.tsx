import React, { useState } from 'react';
import { Play, Square, Terminal as TermIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { useTerminalStore } from '../../stores/terminalStore.js';
import { api } from '../../services/api.js';

export const RunDebugView: React.FC = () => {
  const { currentProject, saveFile } = useProjectStore();
  const { tabs, activeTabId } = useEditorStore();
  const { openPanel, addOutputLog } = useTerminalStore();

  const [isRunning, setIsRunning] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleRun = async () => {
    if (!currentProject || !activeTab) {
      openPanel('output');
      addOutputLog('Please select an active file to run.', 'error');
      return;
    }

    setIsRunning(true);
    setLastStatus('Running...');
    openPanel('output');
    addOutputLog(`[CollabIDE Runner] Launching ${activeTab.title} in project workspace...`, 'info');

    try {
      let content: string | undefined;
      if (typeof (window as any).__collabide_get_active_content === 'function') {
        content = (window as any).__collabide_get_active_content();
      }

      if (typeof (window as any).__collabide_save_active === 'function') {
        await (window as any).__collabide_save_active();
      } else if (content !== undefined) {
        await saveFile(activeTab.fileId, content);
      }

      const res = await api.execution.runFile(currentProject.id, activeTab.fileId, content);
      if (res.stdout) addOutputLog(res.stdout, 'info');
      if (res.stderr) addOutputLog(res.stderr, 'error');
      const msg = `Process exited with code ${res.exitCode} (${res.durationMs}ms)`;
      addOutputLog(`[CollabIDE Runner] ${msg}`, res.exitCode === 0 ? 'success' : 'error');
      setLastStatus(res.exitCode === 0 ? 'Success' : `Failed (code ${res.exitCode})`);
    } catch (err: any) {
      addOutputLog(`Execution failed: ${err.message}`, 'error');
      setLastStatus('Error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    if (!currentProject) return;
    try {
      await api.execution.stopAll(currentProject.id);
      addOutputLog('[CollabIDE Runner] Stopped all running processes.', 'info');
      setIsRunning(false);
      setLastStatus('Stopped');
    } catch (err: any) {
      addOutputLog(`Stop error: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span>RUN AND DEBUG</span>
      </div>

      <div className="sidebar-content" style={{ padding: '12px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 8 }}>
            RUN CONFIGURATION
          </div>

          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#252526',
              borderRadius: 4,
              border: '1px solid #3c3c3c',
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Active Target:</div>
            <div style={{ fontWeight: 600, color: 'white', marginTop: 2 }}>
              {activeTab ? activeTab.title : 'None selected'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRun}
              disabled={isRunning || !activeTab}
              style={{
                flex: 1,
                background: isRunning ? '#334155' : '#16a34a',
                color: 'white',
                border: 'none',
                padding: '6px 0',
                borderRadius: 4,
                cursor: isRunning || !activeTab ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Play size={13} fill="white" />
              <span>{isRunning ? 'Running...' : 'Run File'}</span>
            </button>

            {isRunning && (
              <button
                onClick={handleStop}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Square size={12} fill="white" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>

        {lastStatus && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 6 }}>
              LAST RUN STATUS
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: lastStatus.includes('Success') ? '#4ade80' : '#f87171',
              }}
            >
              {lastStatus.includes('Success') ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{lastStatus}</span>
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 6 }}>
            QUICK ACCESS
          </div>
          <button
            onClick={() => openPanel('terminal')}
            style={{
              width: '100%',
              background: '#252526',
              border: '1px solid #3c3c3c',
              color: '#cccccc',
              padding: '6px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
            }}
          >
            <TermIcon size={14} />
            <span>Open Terminal Console</span>
          </button>
        </div>
      </div>
    </div>
  );
};
