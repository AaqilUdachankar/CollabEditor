import React, { useState } from 'react';
import {
  X,
  History,
  GitCommit,
  RotateCcw,
  Eye,
  FileCode,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Layers,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import { useHistoryStore } from '../../stores/historyStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { IFileVersion } from '../../types/ide.js';

export const FileHistoryModal: React.FC = () => {
  const {
    isOpen,
    activeFile,
    versions,
    selectedVersionId,
    compareVersionId,
    originalContent,
    modifiedContent,
    diffSummary,
    diffLines,
    viewMode,
    isLoading,
    isDiffLoading,
    isRestoring,
    error,
    permissionDenied,
    confirmRestoreVersion,
    closeHistory,
    loadVersions,
    selectVersion,
    setCompareVersion,
    setViewMode,
    requestRestore,
    cancelRestore,
    confirmRestore,
  } = useHistoryStore();

  const { currentProject, loadFiles } = useProjectStore();
  const { settings } = useSettingsStore();
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen || !activeFile) return null;

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const isViewer = currentProject?.role === 'viewer';

  const handlePerformRestore = async () => {
    await confirmRestore((updatedFile) => {
      setSuccessToast(`Restored to Version ${confirmRestoreVersion?.versionNumber} successfully!`);
      if (currentProject) {
        loadFiles(currentProject.id);
      }
      setTimeout(() => setSuccessToast(null), 4000);
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={closeHistory}
    >
      <div
        style={{
          width: '92vw',
          maxWidth: '1280px',
          height: '86vh',
          backgroundColor: '#1e1e1e',
          borderRadius: '8px',
          border: '1px solid #333333',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #333333',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '6px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <History size={16} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>File Version History</span>
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>—</span>
                <span style={{ color: '#38bdf8' }}>{activeFile.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#2e2e2e',
                    color: '#a1a1aa',
                  }}
                >
                  {activeFile.path}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {successToast && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  color: '#6ee7b7',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <CheckCircle2 size={14} />
                <span>{successToast}</span>
              </div>
            )}

            <button
              onClick={closeHistory}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Permission Denied Alert State */}
        {permissionDenied && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#451a1a',
              borderBottom: '1px solid #7f1d1d',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 13,
            }}
          >
            <ShieldAlert size={20} color="#ef4444" />
            <div>
              <strong>Access Denied:</strong> {error}
            </div>
          </div>
        )}

        {/* Generic Error State Banner */}
        {!permissionDenied && error && (
          <div
            style={{
              padding: '10px 18px',
              backgroundColor: '#3b2512',
              borderBottom: '1px solid #78350f',
              color: '#fcd34d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} color="#f59e0b" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadVersions()}
              style={{
                background: '#78350f',
                border: 'none',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Modal Main Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Panel: Saved Versions List */}
          <div
            style={{
              width: '320px',
              borderRight: '1px solid #2d2d2d',
              backgroundColor: '#181818',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid #282828',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#888888',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={13} />
                <span>Saved Versions ({versions.length})</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', gap: 10, color: '#888888', fontSize: 12 }}>
                  <Loader2 size={24} className="spin-animation" color="#38bdf8" />
                  <span>Loading file versions...</span>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && versions.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', gap: 12, color: '#777777', fontSize: 12 }}>
                  <History size={32} style={{ opacity: 0.3 }} />
                  <div>No saved versions found for this file yet.</div>
                  <div style={{ fontSize: 11, color: '#555555' }}>
                    Save changes using Ctrl+S or let collaborative autosave generate historical snapshots.
                  </div>
                </div>
              )}

              {/* Version Items */}
              {!isLoading &&
                versions.map((ver) => {
                  const isSelected = ver.id === selectedVersionId;
                  return (
                    <div
                      key={ver.id}
                      onClick={() => selectVersion(ver.id)}
                      style={{
                        padding: '10px 12px',
                        marginBottom: '4px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#263342' : 'transparent',
                        border: isSelected ? '1px solid #1e4976' : '1px solid transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isSelected ? '#38bdf8' : '#e5e7eb',
                          }}
                        >
                          v{ver.versionNumber}
                        </span>
                        <span style={{ fontSize: 11, color: '#71717a' }}>{formatSize(ver.size)}</span>
                      </div>

                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ver.summary || 'Checkpoint snapshot'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#71717a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <UserIcon size={10} />
                          <span>{ver.authorName}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} />
                          <span>{formatDate(ver.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Right Panel: Diff & Preview Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#1e1e1e' }}>
            {/* Toolbar: Compare Selector, View Mode & Restore Action */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderBottom: '1px solid #2d2d2d',
                backgroundColor: '#222222',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {/* Left: View Mode Toggle & Comparison Target */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', backgroundColor: '#181818', borderRadius: 4, padding: 2, border: '1px solid #333' }}>
                  <button
                    onClick={() => setViewMode('diff')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 3,
                      border: 'none',
                      backgroundColor: viewMode === 'diff' ? '#2563eb' : 'transparent',
                      color: viewMode === 'diff' ? '#ffffff' : '#9ca3af',
                      cursor: 'pointer',
                    }}
                  >
                    <GitCommit size={12} />
                    <span>Diff View</span>
                  </button>

                  <button
                    onClick={() => setViewMode('preview')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 3,
                      border: 'none',
                      backgroundColor: viewMode === 'preview' ? '#2563eb' : 'transparent',
                      color: viewMode === 'preview' ? '#ffffff' : '#9ca3af',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={12} />
                    <span>Full Preview</span>
                  </button>
                </div>

                {viewMode === 'diff' && selectedVersion && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ca3af' }}>
                    <span>Comparing:</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>v{selectedVersion.versionNumber}</span>
                    <ArrowRight size={12} />
                    <select
                      value={compareVersionId}
                      onChange={(e) => setCompareVersion(e.target.value)}
                      style={{
                        backgroundColor: '#181818',
                        color: '#e5e7eb',
                        border: '1px solid #3c3c3c',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="current">Current Editor Content</option>
                      {versions
                        .filter((v) => v.id !== selectedVersionId)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            Version {v.versionNumber} ({formatDate(v.createdAt)})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Right: Diff Stats and Restore Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {viewMode === 'diff' && diffSummary && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                      +{diffSummary.addedCount} lines
                    </span>
                    <span style={{ color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                      -{diffSummary.removedCount} lines
                    </span>
                  </div>
                )}

                {selectedVersion && (
                  <button
                    disabled={isViewer || isRestoring}
                    onClick={() => requestRestore(selectedVersion)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '5px 12px',
                      borderRadius: 4,
                      border: 'none',
                      backgroundColor: isViewer ? '#333333' : '#2563eb',
                      color: isViewer ? '#888888' : '#ffffff',
                      cursor: isViewer ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    title={isViewer ? 'Edit permission required to restore' : 'Restore this version as active file'}
                  >
                    <RotateCcw size={13} />
                    <span>Restore v{selectedVersion.versionNumber}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Viewport Content */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {isDiffLoading && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(30,30,30,0.6)', backdropFilter: 'blur(1px)' }}>
                  <Loader2 size={28} className="spin-animation" color="#38bdf8" />
                </div>
              )}

              {/* Diff Mode (Monaco DiffEditor) */}
              {viewMode === 'diff' && selectedVersion && (
                <DiffEditor
                  original={originalContent}
                  modified={modifiedContent}
                  language={activeFile.language || 'plaintext'}
                  theme={settings.theme === 'vs-dark' ? 'nexus-dark' : settings.theme}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    automaticLayout: true,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', Consolas, monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                  }}
                />
              )}

              {/* Preview Mode (Single Monaco Editor ReadOnly) */}
              {viewMode === 'preview' && selectedVersion && (
                <Editor
                  value={selectedVersion.content}
                  language={activeFile.language || 'plaintext'}
                  theme={settings.theme === 'vs-dark' ? 'nexus-dark' : settings.theme}
                  options={{
                    readOnly: true,
                    automaticLayout: true,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', Consolas, monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                  }}
                />
              )}

              {!selectedVersion && !isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: 13, gap: 8 }}>
                  <FileCode size={32} style={{ opacity: 0.3 }} />
                  <span>Select a version on the left to inspect differences.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Modal Before Restore */}
        {confirmRestoreVersion && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 600,
            }}
          >
            <div
              style={{
                width: '460px',
                backgroundColor: '#252526',
                borderRadius: '8px',
                border: '1px solid #444',
                padding: '20px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RotateCcw size={18} color="#3b82f6" />
                </div>
                <h3 style={{ margin: 0, fontSize: 16, color: '#f3f4f6' }}>
                  Restore to Version {confirmRestoreVersion.versionNumber}?
                </h3>
              </div>

              <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.5, marginBottom: 16 }}>
                You are about to restore <strong>{activeFile.name}</strong> to the snapshot taken on{' '}
                <strong>{formatDate(confirmRestoreVersion.createdAt)}</strong> by{' '}
                <strong>{confirmRestoreVersion.authorName}</strong>.
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#93c5fd',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid #1e40af',
                  borderRadius: 6,
                  padding: '10px 12px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>
                  ⚡ <strong>Note:</strong> History is never silently deleted. A new version record will be created to preserve this restore operation, and other collaborators will receive the update immediately.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  disabled={isRestoring}
                  onClick={cancelRestore}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 4,
                    border: '1px solid #444',
                    backgroundColor: '#2d2d2d',
                    color: '#e5e7eb',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  disabled={isRestoring}
                  onClick={handlePerformRestore}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 4,
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {isRestoring ? (
                    <>
                      <Loader2 size={13} className="spin-animation" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={13} />
                      <span>Confirm Restore</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
