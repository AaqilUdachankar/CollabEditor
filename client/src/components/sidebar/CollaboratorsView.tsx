import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Circle,
  History,
  RefreshCw,
  FileText,
  Play,
  GitCommit,
  Filter,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useCollaborationStore } from '../../stores/collaborationStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { api } from '../../services/api.js';
import { IActivityRecord } from '../../types/ide.js';

type TabType = 'participants' | 'activity';

export const CollaboratorsView: React.FC = () => {
  const { currentProject } = useProjectStore();
  const { collaborators } = useCollaborationStore();
  const { setInviteModalOpen } = useSettingsStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabType>('participants');
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Workspace Activity state
  const [activities, setActivities] = useState<IActivityRecord[]>([]);
  const [activityFilter, setActivityFilter] = useState('');
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    if (currentProject) {
      loadMembers();
      loadActivities(1, true);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    if (currentProject && activeTab === 'activity') {
      loadActivities(1, true);
    }
  }, [activityFilter]);

  const loadMembers = async () => {
    if (!currentProject) return;
    setIsLoadingMembers(true);
    try {
      const res = await api.collaboration.getMembers(currentProject.id);
      setMembers(res.members || []);
    } catch (err) {
      console.error('[Load Members Error]', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const loadActivities = async (pageToLoad: number = 1, replace: boolean = false) => {
    if (!currentProject) return;
    setIsLoadingActivities(true);
    setActivityError(null);
    try {
      const res = await api.activities.getWorkspaceActivities(currentProject.id, {
        eventType: activityFilter || undefined,
        page: pageToLoad,
        limit: 15,
      });

      if (replace) {
        setActivities(res.activities);
      } else {
        setActivities((prev) => [...prev, ...res.activities]);
      }

      setActivityPage(pageToLoad);
      setHasMoreActivities(pageToLoad < res.totalPages);
    } catch (err: any) {
      setActivityError(err.message || 'Failed to load workspace activity');
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!currentProject) return;
    try {
      await api.collaboration.updateRole(currentProject.id, userId, newRole);
      await loadMembers();
      loadActivities(1, true);
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentProject) return;
    if (confirm('Are you sure you want to remove this member from the workspace?')) {
      try {
        await api.collaboration.removeMember(currentProject.id, userId);
        await loadMembers();
        loadActivities(1, true);
      } catch (err: any) {
        alert(`Failed to remove member: ${err.message}`);
      }
    }
  };

  const isOwner = currentProject?.ownerId === user?.id;

  const getActivityIcon = (eventType: string) => {
    if (eventType.includes('execution')) return <Play size={11} color="#10b981" />;
    if (eventType.includes('git')) return <GitCommit size={11} color="#f59e0b" />;
    if (eventType.includes('file')) return <FileText size={11} color="#38bdf8" />;
    return <Users size={11} color="#8b5cf6" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#1e1e1e' }}>
      {/* Header */}
      <div className="sidebar-header" style={{ borderBottom: '1px solid #282828' }}>
        <span>WORKSPACE TEAM & ACTIVITY</span>
        <div className="sidebar-actions">
          <button
            className="sidebar-icon-btn"
            title="Invite Collaborator"
            onClick={() => setInviteModalOpen(true)}
          >
            <UserPlus size={14} />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #282828',
          backgroundColor: '#181818',
        }}
      >
        <button
          onClick={() => setActiveTab('participants')}
          style={{
            flex: 1,
            padding: '8px 10px',
            backgroundColor: activeTab === 'participants' ? '#1e1e1e' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'participants' ? '2px solid #007acc' : '2px solid transparent',
            color: activeTab === 'participants' ? 'white' : '#858585',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Users size={13} />
          <span>Participants ({collaborators.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          style={{
            flex: 1,
            padding: '8px 10px',
            backgroundColor: activeTab === 'activity' ? '#1e1e1e' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'activity' ? '2px solid #007acc' : '2px solid transparent',
            color: activeTab === 'activity' ? 'white' : '#858585',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <History size={13} />
          <span>Activity</span>
        </button>
      </div>

      {/* Tab 1: Participants & Members */}
      {activeTab === 'participants' && (
        <div className="sidebar-content" style={{ padding: '10px', overflowY: 'auto' }}>
          {/* Live Online Active Peers */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#858585',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Circle size={8} fill="#22c55e" color="#22c55e" />
                <span>ONLINE NOW ({collaborators.length})</span>
              </div>
            </div>

            {collaborators.map((c) => (
              <div
                key={c.socketId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  marginBottom: 4,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid #282828',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: c.avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {c.username.substring(0, 2).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 12, color: 'white' }}>
                    {c.username} {c.userId === user?.id ? '(You)' : ''}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.activeFilePath
                      ? `${c.activeFilePath}:${c.cursorLine}:${c.cursorCol}`
                      : 'Viewing workbench'}
                  </div>
                </div>
              </div>
            ))}

            {collaborators.length === 0 && (
              <div style={{ fontSize: 11, color: '#858585', padding: '6px 8px' }}>
                No active peers in this workspace right now.
              </div>
            )}
          </div>

          {/* Project Membership Roles */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 8 }}>
              MEMBERS ({members.length})
            </div>

            {members.map((m) => (
              <div
                key={m.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderBottom: '1px solid #282828',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      backgroundColor: m.avatarColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 9,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {m.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'white', fontWeight: 500 }}>{m.username}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{m.role}</div>
                  </div>
                </div>

                {isOwner && m.role !== 'owner' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                      style={{
                        background: '#2a2a2a',
                        color: '#cccccc',
                        border: '1px solid #3c3c3c',
                        fontSize: 10,
                        borderRadius: 3,
                        padding: '2px 4px',
                      }}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      title="Remove from project"
                      className="sidebar-icon-btn"
                      style={{ color: '#f87171' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Shared Workspace Activity Feed */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Activity Filters Bar */}
          <div
            style={{
              padding: '6px 10px',
              borderBottom: '1px solid #282828',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              backgroundColor: '#1c1c1c',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
              <Filter size={11} color="#858585" />
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                style={{
                  background: '#252526',
                  color: '#ccc',
                  border: '1px solid #3c3c3c',
                  fontSize: 10,
                  borderRadius: 3,
                  padding: '2px 4px',
                  width: '100%',
                }}
              >
                <option value="">All Shared Activity</option>
                <option value="file:create">File Created</option>
                <option value="file:save">File Saved</option>
                <option value="file:rename">File Renamed</option>
                <option value="file:delete">File Deleted</option>
                <option value="execution:complete">Executions</option>
                <option value="git:commit">Git Commits</option>
                <option value="member:join">Member Joined</option>
              </select>
            </div>

            <button
              onClick={() => loadActivities(1, true)}
              title="Refresh Activity"
              className="sidebar-icon-btn"
            >
              <RefreshCw size={12} className={isLoadingActivities ? 'spin' : ''} />
            </button>
          </div>

          {/* Activity List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {activityError && (
              <div style={{ fontSize: 11, color: '#f87171', padding: '6px 8px', marginBottom: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 4 }}>
                {activityError}
              </div>
            )}

            {isLoadingActivities && activities.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#858585', fontSize: 11 }}>
                Loading workspace activity...
              </div>
            ) : activities.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#858585', fontSize: 11 }}>
                No recent activity recorded for this workspace. Edits, saves, executions, and commits by team members will appear here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activities.map((act) => {
                  const meta = act.metadata || {};
                  return (
                    <div
                      key={act.id}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#252526',
                        borderRadius: 4,
                        border: '1px solid #2f2f2f',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {getActivityIcon(act.eventType)}
                        <span style={{ fontWeight: 600, color: 'white', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {act.action}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, color: '#777', fontSize: 10 }}>
                        <span>by <strong style={{ color: '#aaa' }}>{act.username}</strong></span>
                        <span>{new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {meta.commitMessage && (
                        <div style={{ marginTop: 3, color: '#fbbf24', fontSize: 10, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{meta.commitMessage}"
                        </div>
                      )}
                    </div>
                  );
                })}

                {hasMoreActivities && (
                  <button
                    disabled={isLoadingActivities}
                    onClick={() => loadActivities(activityPage + 1, false)}
                    style={{
                      marginTop: 8,
                      padding: '6px 8px',
                      backgroundColor: '#2a2a2a',
                      color: '#ccc',
                      border: '1px solid #3c3c3c',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {isLoadingActivities ? 'Loading...' : 'Load Older Activity'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
