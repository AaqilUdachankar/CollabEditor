import React, { useState, useEffect } from 'react';
import { Play, Square, Terminal as TermIcon, CheckCircle2, AlertCircle, AlertTriangle, Layers, Info } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useEditorStore } from '../../stores/editorStore.js';
import { useTerminalStore } from '../../stores/terminalStore.js';
import { api } from '../../services/api.js';
import { LanguageIcon } from '../common/LanguageIcon.js';

interface RunConfigData {
  projectId: string;
  projectName: string;
  template: string;
  entryFile: string;
  entryFileId: string | null;
  runnerInfo: {
    language: string;
    runner: string;
    command: string;
    toolRequired: string;
    isToolInstalled: boolean;
    folderConventions: string;
  };
  toolchains: Record<string, { installed: boolean; version?: string }>;
}

export const RunDebugView: React.FC = () => {
  const { currentProject, saveFile } = useProjectStore();
  const { tabs, activeTabId } = useEditorStore();
  const { openPanel, addOutputLog } = useTerminalStore();

  const [isRunning, setIsRunning] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [runConfig, setRunConfig] = useState<RunConfigData | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Load run configuration whenever current project changes
  useEffect(() => {
    if (!currentProject) {
      setRunConfig(null);
      return;
    }

    let isMounted = true;
    setIsLoadingConfig(true);

    api.execution
      .getRunConfig(currentProject.id)
      .then((config) => {
        if (isMounted) setRunConfig(config);
      })
      .catch((err) => {
        console.warn('[Run Configuration]', err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingConfig(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentProject?.id]);

  const handleRun = async (forceEntry = false) => {
    if (!currentProject) {
      openPanel('output');
      addOutputLog('Please select a project to run.', 'error');
      return;
    }

    setIsRunning(true);
    setLastStatus('Running...');
    openPanel('output');

    try {
      if (!forceEntry && activeTab) {
        addOutputLog(`[CollabIDE Runner] Launching active file ${activeTab.title}...`, 'info');

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
      } else {
        // Execute project entry file
        const entryTarget = runConfig?.entryFile || 'workspace default entry';
        addOutputLog(`[CollabIDE Runner] Launching project entry target (${entryTarget})...`, 'info');

        const res = await api.execution.runEntryFile(currentProject.id);
        if (res.stdout) addOutputLog(res.stdout, 'info');
        if (res.stderr) addOutputLog(res.stderr, 'error');
        const msg = `Process exited with code ${res.exitCode} (${res.durationMs}ms)`;
        addOutputLog(`[CollabIDE Runner] ${msg}`, res.exitCode === 0 ? 'success' : 'error');
        setLastStatus(res.exitCode === 0 ? 'Success' : `Failed (code ${res.exitCode})`);
      }
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

  const targetFilename = activeTab ? activeTab.title : runConfig?.entryFile || 'No target configured';
  const isToolMissing = runConfig && !runConfig.runnerInfo.isToolInstalled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span>RUN AND DEBUG</span>
      </div>

      <div className="sidebar-content" style={{ padding: '12px', overflowY: 'auto' }}>
        {/* RUN CONFIGURATION CARD */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 8, letterSpacing: '0.05em' }}>
            RUN CONFIGURATION & CONVENTIONS
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#252526',
              borderRadius: 4,
              border: '1px solid #3c3c3c',
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>Active Target:</span>
              <span
                style={{
                  fontSize: 10,
                  color: activeTab ? '#38bdf8' : '#a855f7',
                  backgroundColor: '#1e293b',
                  padding: '1px 5px',
                  borderRadius: 3,
                }}
              >
                {activeTab ? 'Open File' : 'Default Entry Point'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <LanguageIcon filename={targetFilename} size={15} />
              <div style={{ fontWeight: 600, color: 'white', wordBreak: 'break-all' }}>
                {targetFilename}
              </div>
            </div>

            {runConfig && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #334155', fontSize: 11 }}>
                <div style={{ color: '#94a3b8', marginBottom: 2 }}>
                  <span style={{ color: '#cbd5e1' }}>Runner:</span> {runConfig.runnerInfo.runner}
                </div>
                <div
                  style={{
                    color: '#64748b',
                    fontFamily: 'monospace',
                    fontSize: 10,
                    backgroundColor: '#18181b',
                    padding: '3px 6px',
                    borderRadius: 3,
                    marginTop: 4,
                    wordBreak: 'break-all',
                  }}
                >
                  $ {runConfig.runnerInfo.command}
                </div>
              </div>
            )}
          </div>

          {/* Missing Toolchain Warning */}
          {isToolMissing && (
            <div
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid #ca8a04',
                borderRadius: 4,
                padding: '8px 10px',
                marginBottom: 10,
                fontSize: 11,
                color: '#fef08a',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertTriangle size={15} color="#eab308" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 600 }}>Tool not in PATH:</span> {runConfig?.runnerInfo.toolRequired} is missing on the server. CollabIDE will provide clear install instructions upon execution.
              </div>
            </div>
          )}

          {/* Run Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => handleRun(false)}
              disabled={isRunning || (!activeTab && !runConfig?.entryFile)}
              style={{
                width: '100%',
                background: isRunning ? '#334155' : '#16a34a',
                color: 'white',
                border: 'none',
                padding: '7px 0',
                borderRadius: 4,
                cursor: isRunning || (!activeTab && !runConfig?.entryFile) ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Play size={13} fill="white" />
              <span>{isRunning ? 'Running...' : activeTab ? 'Run Current File' : 'Run Project Entry'}</span>
            </button>

            {runConfig?.entryFile && activeTab && (
              <button
                onClick={() => handleRun(true)}
                disabled={isRunning}
                style={{
                  width: '100%',
                  background: '#252526',
                  color: '#94a3b8',
                  border: '1px solid #3c3c3c',
                  padding: '5px 0',
                  borderRadius: 4,
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>Run Project Entry ({runConfig.entryFile})</span>
              </button>
            )}

            {isRunning && (
              <button
                onClick={handleStop}
                style={{
                  width: '100%',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '6px 0',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                }}
              >
                <Square size={12} fill="white" />
                <span>Stop Execution</span>
              </button>
            )}
          </div>
        </div>

        {/* Status result */}
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

        {/* FOLDER CONVENTIONS INFO */}
        {runConfig && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 6 }}>
              WORKSPACE CONVENTIONS
            </div>
            <div
              style={{
                padding: '8px 10px',
                backgroundColor: '#1e293b',
                borderRadius: 4,
                border: '1px solid #334155',
                fontSize: 11,
                color: '#cbd5e1',
                lineHeight: 1.4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', marginBottom: 4, fontWeight: 600 }}>
                <Layers size={13} />
                <span>{runConfig.template.toUpperCase()} Template</span>
              </div>
              <div>{runConfig.runnerInfo.folderConventions}</div>
            </div>
          </div>
        )}

        {/* QUICK ACCESS */}
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
