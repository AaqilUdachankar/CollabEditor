import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Check,
  Plus,
  Minus,
  FileDiff,
  RefreshCw,
  GitCommit as CommitIcon,
  FolderGit2
} from 'lucide-react';
import { useGitStore } from '../../stores/gitStore.js';
import { useProjectStore } from '../../stores/projectStore.js';

export const SourceControlView: React.FC = () => {
  const { currentProject } = useProjectStore();
  const {
    status,
    commits,
    isLoading,
    loadStatus,
    loadHistory,
    initRepo,
    stageFile,
    unstageFile,
    commit,
    loadDiff,
  } = useGitStore();

  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    if (currentProject) {
      loadStatus(currentProject.id);
      loadHistory(currentProject.id);
    }
  }, [currentProject?.id]);

  if (!currentProject) {
    return <div style={{ padding: 16, color: '#858585' }}>No project selected</div>;
  }

  const isUninitialized = status?.branch === 'uninitialized';
  const stagedFiles = status?.files.filter((f) => f.staged) || [];
  const unstagedFiles = status?.files.filter((f) => !f.staged) || [];

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || stagedFiles.length === 0) return;

    setIsCommitting(true);
    try {
      await commit(currentProject.id, commitMessage.trim());
      setCommitMessage('');
    } catch (err: any) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span>SOURCE CONTROL</span>
        <div className="sidebar-actions">
          <button
            className="sidebar-icon-btn"
            title="Refresh Git Status"
            onClick={() => {
              loadStatus(currentProject.id);
              loadHistory(currentProject.id);
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="sidebar-content" style={{ padding: '8px' }}>
        {isUninitialized ? (
          <div style={{ padding: '24px 8px', textAlign: 'center' }}>
            <FolderGit2 size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
            <p style={{ fontSize: 12, color: '#858585', marginBottom: 12 }}>
              No Git repository found in this project.
            </p>
            <button
              onClick={() => initRepo(currentProject.id)}
              style={{
                background: '#007acc',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Initialize Git Repository
            </button>
          </div>
        ) : (
          <div>
            {/* Branch Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: '#94a3b8' }}>
              <GitBranch size={14} color="#38bdf8" />
              <span>Branch: <strong>{status?.branch || 'main'}</strong></span>
            </div>

            {/* Commit Message Box */}
            <form onSubmit={handleCommit} style={{ marginBottom: 12 }}>
              <textarea
                rows={2}
                placeholder="Commit message (Enter to commit)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommit(e);
                  }
                }}
                style={{
                  width: '100%',
                  background: '#2a2a2a',
                  border: '1px solid #3c3c3c',
                  color: 'white',
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
                style={{
                  width: '100%',
                  marginTop: 6,
                  background: stagedFiles.length > 0 && commitMessage.trim() ? '#007acc' : '#334155',
                  color: 'white',
                  border: 'none',
                  padding: '5px 0',
                  borderRadius: 4,
                  cursor: stagedFiles.length > 0 && commitMessage.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Check size={14} />
                <span>{isCommitting ? 'Committing...' : `Commit (${stagedFiles.length})`}</span>
              </button>
            </form>

            {/* Staged Changes */}
            {stagedFiles.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 4 }}>
                  STAGED CHANGES ({stagedFiles.length})
                </div>
                {stagedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="file-node"
                    style={{ justifyContent: 'space-between', padding: '3px 6px' }}
                  >
                    <span style={{ fontSize: 12, color: '#4ade80' }}>{file.path}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => loadDiff(currentProject.id, file.path)}
                        title="View Diff"
                        className="sidebar-icon-btn"
                      >
                        <FileDiff size={12} />
                      </button>
                      <button
                        onClick={() => unstageFile(currentProject.id, file.path)}
                        title="Unstage Changes"
                        className="sidebar-icon-btn"
                      >
                        <Minus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unstaged Changes */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 4 }}>
                CHANGES ({unstagedFiles.length})
              </div>
              {unstagedFiles.map((file) => (
                <div
                  key={file.path}
                  className="file-node"
                  style={{ justifyContent: 'space-between', padding: '3px 6px' }}
                >
                  <span style={{ fontSize: 12, color: file.status === 'untracked' ? '#38bdf8' : '#facc15' }}>
                    {file.path}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => loadDiff(currentProject.id, file.path)}
                      title="View Diff"
                      className="sidebar-icon-btn"
                    >
                      <FileDiff size={12} />
                    </button>
                    <button
                      onClick={() => stageFile(currentProject.id, file.path)}
                      title="Stage Changes"
                      className="sidebar-icon-btn"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {unstagedFiles.length === 0 && stagedFiles.length === 0 && (
                <div style={{ fontSize: 12, color: '#858585', padding: '4px 6px' }}>
                  No changes detected. Working tree is clean.
                </div>
              )}
            </div>

            {/* Commit History */}
            {commits.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 6 }}>
                  COMMITS ({commits.length})
                </div>
                {commits.slice(0, 10).map((c) => (
                  <div
                    key={c.hash}
                    style={{
                      padding: '4px 6px',
                      borderLeft: '2px solid #007acc',
                      marginBottom: 6,
                      fontSize: 11,
                      backgroundColor: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ fontWeight: 500, color: '#ffffff' }}>{c.message}</div>
                    <div style={{ color: '#858585', fontSize: 10, display: 'flex', gap: 8, marginTop: 2 }}>
                      <span>{c.author}</span>
                      <span>{c.shortHash}</span>
                      <span>{c.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
