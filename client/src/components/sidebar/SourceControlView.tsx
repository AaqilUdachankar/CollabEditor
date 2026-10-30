import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Check,
  Plus,
  Minus,
  FileDiff,
  RefreshCw,
  FolderGit2,
  AlertTriangle,
  AlertCircle,
  X,
  Info,
  Loader2,
  GitCommit as CommitIcon,
} from 'lucide-react';
import { useGitStore } from '../../stores/gitStore.js';
import { useProjectStore } from '../../stores/projectStore.js';

export const SourceControlView: React.FC = () => {
  const { currentProject } = useProjectStore();
  const {
    status,
    commits,
    isLoading,
    isCommitting,
    error,
    gitAvailable,
    loadStatus,
    loadHistory,
    initRepo,
    stageFile,
    stageAll,
    unstageFile,
    commit,
    loadDiff,
    clearError,
  } = useGitStore();

  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    if (currentProject) {
      loadStatus(currentProject.id);
      loadHistory(currentProject.id);
    }
  }, [currentProject?.id]);

  if (!currentProject) {
    return (
      <div style={{ padding: 16, color: 'var(--vsc-text-muted, #858585)', fontSize: 12 }}>
        No active project selected
      </div>
    );
  }

  // Unavailable Git binary check
  if (!gitAvailable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--vsc-bg-sidebar, #1e1e1e)' }}>
        <div className="sidebar-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--vsc-border, #282828)' }}>
          <span>SOURCE CONTROL</span>
        </div>
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <AlertTriangle size={36} style={{ color: '#f59e0b', margin: '0 auto 12px auto' }} />
          <h4 style={{ color: '#f3f4f6', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Git Binary Not Detected
          </h4>
          <p style={{ fontSize: 12, color: 'var(--vsc-text-muted, #858585)', lineHeight: 1.5, marginBottom: 12 }}>
            Git is not installed on this system or is not accessible in the PATH environment variable.
          </p>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#fbbf24',
              fontSize: 11,
              textAlign: 'left',
            }}
          >
            Please install Git and restart the server to use source control.
          </div>
        </div>
      </div>
    );
  }

  const isUninitialized = status?.isRepo === false || status?.branch === 'uninitialized';
  const stagedFiles = status?.files?.filter((f) => f.staged) || [];
  const unstagedFiles = status?.files?.filter((f) => !f.staged) || [];

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || stagedFiles.length === 0 || isCommitting) return;

    try {
      await commit(currentProject.id, commitMessage.trim());
      setCommitMessage('');
    } catch {
      // Error handled by store state
    }
  };

  const getStatusBadge = (statusType: string) => {
    switch (statusType) {
      case 'modified':
        return <span style={{ color: '#facc15', fontSize: 11, fontWeight: 600 }}>M</span>;
      case 'added':
        return <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }}>A</span>;
      case 'deleted':
        return <span style={{ color: '#f87171', fontSize: 11, fontWeight: 600 }}>D</span>;
      case 'untracked':
        return <span style={{ color: '#38bdf8', fontSize: 11, fontWeight: 600 }}>U</span>;
      default:
        return <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>•</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--vsc-bg-sidebar, #1e1e1e)' }}>
      {/* Header */}
      <div
        className="sidebar-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--vsc-border, #282828)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'var(--vsc-text-muted, #858585)',
        }}
      >
        <span>SOURCE CONTROL</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="sidebar-icon-btn"
            title="Refresh Git Status"
            onClick={() => {
              loadStatus(currentProject.id);
              loadHistory(currentProject.id);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--vsc-text-muted, #858585)',
              cursor: 'pointer',
              display: 'flex',
              padding: 2,
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {/* Error Alert Banner */}
        {error && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 4,
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: 11,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              marginBottom: 10,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, wordBreak: 'break-word' }}>{error}</div>
            <button
              type="button"
              onClick={clearError}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Repository Not Initialized State */}
        {isUninitialized ? (
          <div style={{ padding: '24px 8px', textAlign: 'center' }}>
            <FolderGit2 size={36} style={{ margin: '0 auto 10px auto', opacity: 0.4, color: '#38bdf8' }} />
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--vsc-text-bright, #ffffff)', marginBottom: 6 }}>
              No Repository Detected
            </h4>
            <p style={{ fontSize: 12, color: 'var(--vsc-text-muted, #858585)', marginBottom: 14, lineHeight: 1.4 }}>
              This project is not currently tracked by Git.
            </p>
            <button
              type="button"
              onClick={() => initRepo(currentProject.id)}
              disabled={isLoading}
              style={{
                background: 'var(--vsc-accent, #007acc)',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 4,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              <span>Initialize Git Repository</span>
            </button>
          </div>
        ) : (
          <div>
            {/* Branch Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                marginBottom: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 4,
                border: '1px solid var(--vsc-border-subtle, #222222)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                <GitBranch size={13} color="#38bdf8" />
                <span>
                  Branch: <strong style={{ color: 'var(--vsc-text-bright, #ffffff)' }}>{status?.branch || 'main'}</strong>
                </span>
              </div>
            </div>

            {/* Commit Message Box */}
            <form onSubmit={handleCommit} style={{ marginBottom: 12 }}>
              <textarea
                rows={2}
                placeholder="Commit message (Enter to commit)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
                    e.preventDefault();
                    handleCommit(e);
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--vsc-input-bg, #2a2a2a)',
                  border: '1px solid var(--vsc-input-border, #3c3c3c)',
                  color: 'var(--vsc-text-bright, #ffffff)',
                  borderRadius: 4,
                  padding: '6px 8px',
                  fontSize: 12,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />

              <button
                type="submit"
                disabled={isCommitting || stagedFiles.length === 0 || !commitMessage.trim()}
                title={stagedFiles.length === 0 ? 'Stage changes before committing' : 'Commit staged changes'}
                style={{
                  width: '100%',
                  marginTop: 6,
                  background:
                    stagedFiles.length > 0 && commitMessage.trim() && !isCommitting
                      ? 'var(--vsc-accent, #007acc)'
                      : 'rgba(255, 255, 255, 0.08)',
                  color:
                    stagedFiles.length > 0 && commitMessage.trim() && !isCommitting
                      ? '#ffffff'
                      : 'var(--vsc-text-subtle, #5a5a5a)',
                  border: 'none',
                  padding: '6px 0',
                  borderRadius: 4,
                  cursor: stagedFiles.length > 0 && commitMessage.trim() && !isCommitting ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {isCommitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Committing...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    <span>Commit Staged ({stagedFiles.length})</span>
                  </>
                )}
              </button>
            </form>

            {/* Staged Changes Section */}
            {stagedFiles.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--vsc-text-muted, #858585)',
                    marginBottom: 4,
                    padding: '2px 4px',
                  }}
                >
                  <span>STAGED CHANGES ({stagedFiles.length})</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {stagedFiles.map((file) => (
                    <div
                      key={file.path}
                      className="file-node"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '3px 6px',
                        borderRadius: 3,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        {getStatusBadge(file.status)}
                        <span
                          style={{
                            color: '#4ade80',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.path}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => loadDiff(currentProject.id, file.path, true)}
                          title="View Staged Diff"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--vsc-text-muted, #858585)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                          }}
                        >
                          <FileDiff size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => unstageFile(currentProject.id, file.path)}
                          title="Unstage Changes"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--vsc-text-muted, #858585)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                          }}
                        >
                          <Minus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Changes / Untracked Section */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--vsc-text-muted, #858585)',
                  marginBottom: 4,
                  padding: '2px 4px',
                }}
              >
                <span>CHANGES ({unstagedFiles.length})</span>
                {unstagedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => stageAll(currentProject.id)}
                    title="Stage All Changes"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--vsc-text-muted, #858585)',
                      cursor: 'pointer',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Plus size={11} />
                    <span>Stage All</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {unstagedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="file-node"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '3px 6px',
                      borderRadius: 3,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      {getStatusBadge(file.status)}
                      <span
                        style={{
                          color: file.status === 'untracked' ? '#38bdf8' : '#facc15',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.path}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => loadDiff(currentProject.id, file.path, false)}
                        title="View Working Tree Diff"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--vsc-text-muted, #858585)',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                        }}
                      >
                        <FileDiff size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => stageFile(currentProject.id, file.path)}
                        title="Stage File"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--vsc-text-muted, #858585)',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                {unstagedFiles.length === 0 && stagedFiles.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--vsc-text-muted, #858585)', padding: '6px 4px' }}>
                    Working tree is clean. No changes detected.
                  </div>
                )}
              </div>
            </div>

            {/* Commit History */}
            {commits.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--vsc-text-muted, #858585)', marginBottom: 6 }}>
                  RECENT COMMITS ({commits.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {commits.slice(0, 10).map((c) => (
                    <div
                      key={c.hash}
                      style={{
                        padding: '4px 8px',
                        borderLeft: '2px solid var(--vsc-accent, #007acc)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '0 3px 3px 0',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ fontWeight: 500, color: 'var(--vsc-text-bright, #ffffff)' }}>
                        {c.message}
                      </div>
                      <div
                        style={{
                          color: 'var(--vsc-text-subtle, #5a5a5a)',
                          fontSize: 10,
                          display: 'flex',
                          gap: 8,
                          marginTop: 2,
                        }}
                      >
                        <span>{c.author}</span>
                        <span style={{ fontFamily: 'var(--vsc-font-code, monospace)' }}>{c.shortHash}</span>
                        <span>{c.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scope & Remote Limitations Notice */}
            <div
              style={{
                marginTop: 20,
                padding: '8px 10px',
                borderRadius: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--vsc-border-subtle, #222222)',
                color: 'var(--vsc-text-muted, #858585)',
                fontSize: 10,
                lineHeight: 1.4,
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
              }}
            >
              <Info size={12} style={{ flexShrink: 0, marginTop: 1, color: '#38bdf8' }} />
              <div>
                <strong>Local Git Workspace:</strong> Status, staging, un-staging, line diffing, and local commits are supported. Remote push and pull are omitted as remote repository synchronization is not configured.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
