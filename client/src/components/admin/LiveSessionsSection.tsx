import React, { useState, useEffect } from 'react';
import {
  Radio,
  FileCode2,
  Clock,
  Circle,
  RefreshCw,
  AlertTriangle,
  FolderGit2,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { ILiveSessionWorkspace } from '../../types/ide.js';

export const LiveSessionsSection: React.FC = () => {
  const [sessionsData, setSessionsData] = useState<{
    activeSessionsCount: number;
    activeUsersCount: number;
    activeWorkspacesCount: number;
    workspaces: ILiveSessionWorkspace[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000); // 5s auto-refresh for live sessions
    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.admin.getSessions();
      setSessionsData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load live sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#252526',
          border: '1px solid #3c3c3c',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio size={18} color="#22c55e" />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'white' }}>
            Live Active Collaboration Sessions
          </span>
          <span
            style={{
              padding: '2px 8px',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {sessionsData?.activeSessionsCount || 0} Connected
          </span>
        </div>

        <button
          onClick={loadSessions}
          title="Refresh active sessions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            backgroundColor: '#1e1e1e',
            color: '#cccccc',
            border: '1px solid #3c3c3c',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Active Workspaces List */}
      {!sessionsData || sessionsData.workspaces.length === 0 ? (
        <div
          style={{
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
            borderRadius: 8,
            padding: 48,
            textAlign: 'center',
            color: '#858585',
          }}
        >
          <Radio size={32} color="#555" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: '#ccc' }}>No active live sessions</div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
            When users connect to workspaces, their live session duration, connection state, and permitted file metadata will appear here in real time.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sessionsData.workspaces.map((ws) => (
            <div
              key={ws.workspaceId}
              style={{
                backgroundColor: '#252526',
                border: '1px solid #3c3c3c',
                borderRadius: 8,
                padding: 16,
              }}
            >
              {/* Workspace Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #333',
                  paddingBottom: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderGit2 size={16} color="#007acc" />
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'white' }}>{ws.workspaceName}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>({ws.workspaceId.substring(0, 8)}...)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e' }}>
                  <Circle size={8} fill="#22c55e" color="#22c55e" />
                  <span>{ws.participantsCount} Participant{ws.participantsCount === 1 ? '' : 's'}</span>
                </div>
              </div>

              {/* Participants Grid / Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 12,
                }}
              >
                {ws.participants.map((p) => (
                  <div
                    key={p.socketId}
                    style={{
                      backgroundColor: '#1e1e1e',
                      border: '1px solid #333',
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: p.avatarColor || '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {p.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>{p.username}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22c55e' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                          <span>{p.connectionState}</span>
                          <span style={{ color: '#64748b' }}>•</span>
                          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} />
                            {formatDuration(p.durationSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Permitted Active-file metadata */}
                    <div
                      style={{
                        marginTop: 10,
                        padding: '6px 8px',
                        backgroundColor: '#252526',
                        borderRadius: 4,
                        fontSize: 11,
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        overflow: 'hidden',
                      }}
                    >
                      <FileCode2 size={13} color="#38bdf8" />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {p.activeFile ? (
                          <span>
                            <strong style={{ color: '#e2e8f0' }}>{p.activeFile.path}</strong>
                            <span style={{ color: '#64748b', marginLeft: 4 }}>
                              (Ln {p.activeFile.line}, Col {p.activeFile.col})
                            </span>
                          </span>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: '#64748b' }}>Viewing project root</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

