import React, { useState } from 'react';
import { X, Copy, Check, UserPlus, Link, KeyRound } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { api } from '../../services/api.js';

export const InviteModal: React.FC = () => {
  const { inviteModalOpen, setInviteModalOpen } = useSettingsStore();
  const { currentProject, selectProject } = useProjectStore();

  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Join by code tab state
  const [joinToken, setJoinToken] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  if (!inviteModalOpen) return null;

  const handleGenerateInvite = async () => {
    if (!currentProject) return;
    setIsGenerating(true);
    try {
      const res = await api.collaboration.createInvitation(currentProject.id, role);
      const url = `${window.location.origin}/#invite=${res.invitation.token}`;
      setInviteLink(url);
    } catch (err: any) {
      alert(`Failed to create invitation: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinToken.trim()) return;

    setIsJoining(true);
    try {
      const res = await api.collaboration.joinByToken(joinToken.trim());
      await selectProject(res.projectId);
      setInviteModalOpen(false);
      alert(`Joined project: ${res.project.name}`);
    } catch (err: any) {
      alert(`Failed to join: ${err.message}`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="palette-overlay" onClick={() => setInviteModalOpen(false)}>
      <div
        className="palette-box"
        style={{ width: '520px', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: '#252526',
            borderBottom: '1px solid #3c3c3c',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'white' }}>
            <UserPlus size={18} color="#38bdf8" />
            <span>Invite Collaborators to {currentProject?.name}</span>
          </div>
          <button
            onClick={() => setInviteModalOpen(false)}
            style={{ background: 'transparent', border: 'none', color: '#858585', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 18px' }}>
          {/* Role selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 6 }}>
              Collaborator Permission Level:
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  backgroundColor: role === 'editor' ? 'rgba(0, 122, 204, 0.2)' : '#252526',
                  border: `1px solid ${role === 'editor' ? '#007acc' : '#3c3c3c'}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'white',
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value="editor"
                  checked={role === 'editor'}
                  onChange={() => setRole('editor')}
                  style={{ display: 'none' }}
                />
                <span>Editor (Can write code & run terminal)</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  backgroundColor: role === 'viewer' ? 'rgba(0, 122, 204, 0.2)' : '#252526',
                  border: `1px solid ${role === 'viewer' ? '#007acc' : '#3c3c3c'}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'white',
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value="viewer"
                  checked={role === 'viewer'}
                  onChange={() => setRole('viewer')}
                  style={{ display: 'none' }}
                />
                <span>Viewer (Read-only live stream)</span>
              </label>
            </div>
          </div>

          {/* Generate Link Button */}
          {!inviteLink ? (
            <button
              onClick={handleGenerateInvite}
              disabled={isGenerating || !currentProject}
              style={{
                width: '100%',
                background: '#007acc',
                color: 'white',
                border: 'none',
                padding: '8px 0',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Link size={14} />
              <span>{isGenerating ? 'Generating...' : 'Create Invite Link'}</span>
            </button>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#cccccc', marginBottom: 4 }}>
                Shareable Link (Expires in 7 days):
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  readOnly
                  type="text"
                  value={inviteLink}
                  style={{
                    flex: 1,
                    background: '#2a2a2a',
                    border: '1px solid #3c3c3c',
                    color: 'white',
                    borderRadius: 4,
                    padding: '6px 10px',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleCopy}
                  style={{
                    background: copied ? '#16a34a' : '#007acc',
                    color: 'white',
                    border: 'none',
                    padding: '0 14px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Join with Invite Token Section */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #3c3c3c' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#cccccc', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <KeyRound size={14} color="#facc15" />
              <span>Or Join a Shared Project via Code:</span>
            </div>
            <form onSubmit={handleJoinProject} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Enter 16-character invite code..."
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                style={{
                  flex: 1,
                  background: '#2a2a2a',
                  border: '1px solid #3c3c3c',
                  color: 'white',
                  borderRadius: 4,
                  padding: '6px 10px',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={isJoining || !joinToken.trim()}
                style={{
                  background: '#334155',
                  color: 'white',
                  border: 'none',
                  padding: '0 14px',
                  borderRadius: 4,
                  cursor: isJoining || !joinToken.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                {isJoining ? 'Joining...' : 'Join'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
