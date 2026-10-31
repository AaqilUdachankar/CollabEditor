import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Circle,
  Video,
  PenTool,
  Sparkles,
  ChevronRight,
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
import { useVideoCallStore } from '../../stores/videoCallStore.js';
import { useWhiteboardStore } from '../../stores/whiteboardStore.js';
import { api } from '../../services/api.js';
import { IActivityRecord } from '../../types/ide.js';

type TabType = 'participants' | 'activity';

export const CollaboratorsView: React.FC = () => {
  const { currentProject } = useProjectStore();
  const { collaborators } = useCollaborationStore();
  const { setInviteModalOpen } = useSettingsStore();
  const { user } = useAuthStore();
  const { initiateCall, invitePeerToCall } = useVideoCallStore();
  const {
    createAndOpenPrivateBoard,
    openBoard,
    deleteBoard,
    workspaceBoards,
    loadProjectBoards,
  } = useWhiteboardStore();

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
      loadProjectBoards(currentProject.id);
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

  // 1. Private 1-to-1 Video Call
  const handleStartCall = (targetUser: any) => {
    if (!currentProject) return;
    initiateCall(
      {
        id: targetUser.userId || targetUser.id,
        username: targetUser.username,
        avatarColor: targetUser.avatarColor,
      },
      currentProject.id
    );
  };

  // 1b. Multi-Person Team Video Call
  const handleStartTeamCall = async () => {
    if (!currentProject) return;
    const otherMembers = members.filter((m) => (m.userId || m.id) !== user?.id);
    if (otherMembers.length === 0) {
      // If alone, call demo teammate
      handleStartCall({ id: 'demo_user_alex', username: 'Alex Rivera', avatarColor: '#10b981' });
      return;
    }

    const first = otherMembers[0];
    await initiateCall(
      { id: first.userId || first.id, username: first.username, avatarColor: first.avatarColor },
      currentProject.id
    );

    // Invite remaining team members
    for (let i = 1; i < otherMembers.length; i++) {
      const next = otherMembers[i];
      await invitePeerToCall(
        { id: next.userId || next.id, username: next.username, avatarColor: next.avatarColor },
        currentProject.id
      );
    }
  };

  // 2. Private Collaborative Whiteboard
  const handleStartWhiteboard = (targetUser: any) => {
    if (!currentProject) return;
    createAndOpenPrivateBoard(
      {
        id: targetUser.userId || targetUser.id,
        username: targetUser.username,
        avatarColor: targetUser.avatarColor,
      },
      currentProject.id
    );
  };

  // 3. Integrated Video + Whiteboard Collaboration Session
  const handleStartCollaboration = async (targetUser: any) => {
    if (!currentProject) return;
    // Initiate video call first
    await initiateCall(
      {
        id: targetUser.userId || targetUser.id,
        username: targetUser.username,
        avatarColor: targetUser.avatarColor,
      },
      currentProject.id
    );
    // Simultaneously launch collaborative whiteboard
    await createAndOpenPrivateBoard(
      {
        id: targetUser.userId || targetUser.id,
        username: targetUser.username,
        avatarColor: targetUser.avatarColor,
      },
      currentProject.id,
      `Collab with ${targetUser.username}`
    );
  };

  const handleDeleteBoard = async (boardId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentProject) return;
    await deleteBoard(boardId, currentProject.id);
  };

  const isOwner = currentProject?.ownerId === user?.id;

  // Check if a member is currently online
  const isUserOnline = (userId: string) => {
    return collaborators.some((c) => c.userId === userId);
  };

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
        <div className="sidebar-content" style={{ padding: '10px', overflowY: 'auto', flex: 1 }}>
          {/* Quick Test Alert Banners Bar */}
          <div
            style={{
              marginBottom: 14,
              padding: '8px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              border: '1px solid #27272a',
            }}
          >
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
              QUICK TEST INVITATIONS:
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                id="btn-trigger-call-alert"
                onClick={() =>
                  useVideoCallStore.getState().handleIncomingCall({
                    callId: `call_test_${Date.now()}`,
                    callerId: 'alex_demo',
                    callerName: 'Alex Rivera',
                    avatarColor: '#10b981',
                    projectId: currentProject?.id || 'demo',
                  })
                }
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔔 Test Call
              </button>
              <button
                id="btn-trigger-board-alert"
                onClick={() =>
                  useWhiteboardStore.getState().handleIncomingInvite({
                    boardId: `wb_test_${Date.now()}`,
                    callerId: 'alex_demo',
                    callerName: 'Alex Rivera',
                    avatarColor: '#10b981',
                    title: 'Sprint Wireframe Session',
                    projectId: currentProject?.id || 'demo',
                  })
                }
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  color: '#c084fc',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🎨 Test Board
              </button>
            </div>
          </div>

          {/* Live Online Active Peers */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 8 }}>
              <Circle size={8} fill="#22c55e" color="#22c55e" />
              <span>ONLINE NOW ({collaborators.length})</span>
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

          {/* Workspace Members & 1-to-1 Action Bar */}
          <div style={{ marginBottom: 18 }}>
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
                <Users size={12} color="#38bdf8" />
                <span>TEAM MEMBERS ({members.length})</span>
              </div>
              <button
                onClick={handleStartTeamCall}
                id="btn-start-team-call"
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
                title="Start Video Call with All Team Members"
              >
                <Video size={11} />
                <span>Team Call</span>
              </button>
            </div>

            {members.map((m) => {
              const isSelf = m.userId === user?.id;
              const online = isUserOnline(m.userId);

              return (
                <div
                  key={m.userId}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '8px 10px',
                    borderRadius: 6,
                    marginBottom: 6,
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid #282828',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ position: 'relative' }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            backgroundColor: m.avatarColor || '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {m.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span
                          style={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: online ? '#22c55e' : '#71717a',
                            border: '1.5px solid #18181b',
                          }}
                          title={online ? 'Online' : 'Offline'}
                        />
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'white' }}>
                          {m.username} {isSelf ? '(You)' : ''}
                        </div>
                        <div style={{ fontSize: 10, color: online ? '#4ade80' : '#71717a' }}>
                          {online ? 'Active now' : 'Offline'} · {m.role}
                        </div>
                      </div>
                    </div>

                    {isOwner && !isSelf && (
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

                  {/* 1-to-1 Private Collaboration Action Buttons */}
                  {!isSelf && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {/* Private Video Call */}
                      <button
                        onClick={() => handleStartCall(m)}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          backgroundColor: '#27272a',
                          border: '1px solid #3f3f46',
                          borderRadius: 4,
                          color: '#60a5fa',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          transition: 'background 0.15s ease',
                        }}
                        title="Start 1-to-1 Private Video Call"
                      >
                        <Video size={11} />
                        <span>Call</span>
                      </button>

                      {/* Private Whiteboard */}
                      <button
                        onClick={() => handleStartWhiteboard(m)}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          backgroundColor: '#27272a',
                          border: '1px solid #3f3f46',
                          borderRadius: 4,
                          color: '#c084fc',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          transition: 'background 0.15s ease',
                        }}
                        title="Create Private Collaborative Whiteboard"
                      >
                        <PenTool size={11} />
                        <span>Board</span>
                      </button>

                      {/* Integrated Video + Whiteboard Collaboration */}
                      <button
                        onClick={() => handleStartCollaboration(m)}
                        style={{
                          flex: 1.2,
                          padding: '4px 6px',
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          borderRadius: 4,
                          color: '#38bdf8',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          transition: 'background 0.15s ease',
                        }}
                        title="Start Private Collaboration (Video + Whiteboard together)"
                      >
                        <Sparkles size={11} />
                        <span>Collab</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* If only self is in members, show demo teammate for instant testing */}
            {members.length <= 1 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 6,
                  marginBottom: 6,
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px dashed #3b82f6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        AR
                      </div>
                      <span
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#22c55e',
                          border: '1.5px solid #18181b',
                        }}
                        title="Online"
                      />
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12, color: 'white' }}>
                        Alex Rivera <span style={{ fontSize: 9, color: '#38bdf8' }}>(Teammate)</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#4ade80' }}>
                        Active now · editor
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons for Alex */}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    onClick={() =>
                      handleStartCall({
                        id: 'demo_user_alex',
                        username: 'Alex Rivera',
                        avatarColor: '#10b981',
                      })
                    }
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: 4,
                      color: '#60a5fa',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                    title="Start 1-to-1 Private Video Call with Alex"
                  >
                    <Video size={11} />
                    <span>Call</span>
                  </button>

                  <button
                    onClick={() =>
                      handleStartWhiteboard({
                        id: 'demo_user_alex',
                        username: 'Alex Rivera',
                        avatarColor: '#10b981',
                      })
                    }
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: 4,
                      color: '#c084fc',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                    title="Create Private Collaborative Whiteboard with Alex"
                  >
                    <PenTool size={11} />
                    <span>Board</span>
                  </button>

                  <button
                    onClick={() =>
                      handleStartCollaboration({
                        id: 'demo_user_alex',
                        username: 'Alex Rivera',
                        avatarColor: '#10b981',
                      })
                    }
                    style={{
                      flex: 1.2,
                      padding: '4px 6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: 4,
                      color: '#38bdf8',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                    title="Start Private Collaboration (Video + Whiteboard together)"
                  >
                    <Sparkles size={11} />
                    <span>Collab</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved Private Whiteboards Section */}
          <div>
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
                <PenTool size={12} color="#c084fc" />
                <span>PRIVATE WHITEBOARDS ({workspaceBoards.length})</span>
              </div>
              <button
                onClick={() => {
                  if (currentProject && user) {
                    createAndOpenPrivateBoard(
                      { id: user.id, username: user.username, avatarColor: user.avatarColor },
                      currentProject.id,
                      `Board ${workspaceBoards.length + 1}`
                    );
                  }
                }}
                style={{
                  background: 'rgba(192, 132, 252, 0.15)',
                  color: '#c084fc',
                  border: '1px solid rgba(192, 132, 252, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 600,
                }}
                title="Create New Whiteboard"
              >
                + New Board
              </button>
            </div>

            {workspaceBoards.map((b) => (
              <div
                key={b.boardId}
                onClick={() => currentProject && openBoard(b.boardId, currentProject.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid #282828',
                  marginBottom: 4,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <PenTool size={13} color="#c084fc" />
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#f4f4f5' }}>
                      {b.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a' }}>
                      Updated {new Date(b.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={(e) => handleDeleteBoard(b.boardId, e)}
                    title="Delete Whiteboard"
                    className="btn-delete-whiteboard"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={13} color="#71717a" />
                </div>
              </div>
            ))}

            {workspaceBoards.length === 0 && (
              <div style={{ fontSize: 11, color: '#71717a', padding: '6px 4px' }}>
                No private whiteboards yet. Click '+ New Board' or 'Board' on a teammate to start!
              </div>
            )}
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
