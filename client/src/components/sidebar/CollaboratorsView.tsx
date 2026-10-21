import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Eye, Edit3, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useCollaborationStore } from '../../stores/collaborationStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { api } from '../../services/api.js';

export const CollaboratorsView: React.FC = () => {
  const { currentProject } = useProjectStore();
  const { collaborators } = useCollaborationStore();
  const { setInviteModalOpen } = useSettingsStore();
  const { user } = useAuthStore();

  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (currentProject) {
      loadMembers();
    }
  }, [currentProject?.id]);

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

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!currentProject) return;
    try {
      await api.collaboration.updateRole(currentProject.id, userId, newRole);
      await loadMembers();
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentProject) return;
    if (confirm('Are you sure you want to remove this member from the project?')) {
      try {
        await api.collaboration.removeMember(currentProject.id, userId);
        await loadMembers();
      } catch (err: any) {
        alert(`Failed to remove member: ${err.message}`);
      }
    }
  };

  const isOwner = currentProject?.ownerId === user?.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span>COLLABORATORS</span>
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

      <div className="sidebar-content" style={{ padding: '10px' }}>
        {/* Live Active Peers */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Circle size={8} fill="#22c55e" color="#22c55e" />
            <span>ONLINE SESSIONS ({collaborators.length})</span>
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
                <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.activeFilePath ? `${c.activeFilePath}:${c.cursorLine}:${c.cursorCol}` : 'Viewing workbench'}
                </div>
              </div>
            </div>
          ))}

          {collaborators.length === 0 && (
            <div style={{ fontSize: 12, color: '#858585', padding: '4px 8px' }}>
              No other collaborators active currently.
            </div>
          )}
        </div>

        {/* Project Membership Roles */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#858585', marginBottom: 8 }}>
            PROJECT MEMBERS ({members.length})
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
    </div>
  );
};
