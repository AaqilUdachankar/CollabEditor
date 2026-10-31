import React from 'react';
import {
  Files,
  Search,
  GitBranch,
  Play,
  Boxes,
  Users,
  Settings,
  User as UserIcon,
  PenTool,
  Shield,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore.js';
import { useGitStore } from '../../stores/gitStore.js';
import { useCollaborationStore } from '../../stores/collaborationStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useWhiteboardStore } from '../../stores/whiteboardStore.js';

export const ActivityBar: React.FC = () => {
  const { activeActivity, setActiveActivity, currentProject } = useProjectStore();
  const { status } = useGitStore();
  const { collaborators } = useCollaborationStore();
  const { setSettingsModalOpen, setAuthModalOpen } = useSettingsStore();
  const { isAuthenticated, user } = useAuthStore();
  const { isOpen, activeBoard, setIsOpen, createAndOpenPrivateBoard } = useWhiteboardStore();

  const modifiedCount = status?.files.length || 0;
  const onlineCount = collaborators.length;

  return (
    <aside className="nexus-activity-bar" aria-label="Activity Bar">
      <div className="activity-bar-group">
        <button
          className={`activity-btn ${activeActivity === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveActivity('explorer')}
          title="Explorer (Ctrl+Shift+E)"
        >
          <Files size={22} />
        </button>

        <button
          className={`activity-btn ${activeActivity === 'search' ? 'active' : ''}`}
          onClick={() => setActiveActivity('search')}
          title="Search (Ctrl+Shift+F)"
        >
          <Search size={22} />
        </button>

        <button
          className={`activity-btn ${activeActivity === 'git' ? 'active' : ''}`}
          onClick={() => setActiveActivity('git')}
          title="Source Control (Ctrl+Shift+G)"
        >
          <GitBranch size={22} />
          {modifiedCount > 0 && <span className="activity-badge">{modifiedCount}</span>}
        </button>

        <button
          className={`activity-btn ${activeActivity === 'debug' ? 'active' : ''}`}
          onClick={() => setActiveActivity('debug')}
          title="Run and Debug (Ctrl+Shift+D)"
        >
          <Play size={22} />
        </button>

        <button
          className={`activity-btn ${activeActivity === 'extensions' ? 'active' : ''}`}
          onClick={() => setActiveActivity('extensions')}
          title="Extensions (Ctrl+Shift+X)"
        >
          <Boxes size={22} />
        </button>

        <button
          className={`activity-btn ${activeActivity === 'collab' ? 'active' : ''}`}
          onClick={() => setActiveActivity('collab')}
          title="Collaborators, Video Calls & Whiteboard"
        >
          <Users size={22} />
          {onlineCount > 0 && <span className="activity-badge">{onlineCount}</span>}
        </button>

        <button
          className={`activity-btn ${isOpen ? 'active' : ''}`}
          onClick={() => {
            if (activeBoard) {
              setIsOpen(!isOpen);
            } else if (currentProject && user) {
              createAndOpenPrivateBoard(
                { id: user.id, username: user.username, avatarColor: user.avatarColor },
                currentProject.id,
                'Project Whiteboard'
              );
            } else {
              setActiveActivity('collab');
            }
          }}
          title="Open Miro Collaborative Whiteboard"
        >
          <PenTool size={22} />
        </button>

        {user?.role === 'admin' && (
          <button
            className={`activity-btn ${activeActivity === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveActivity(activeActivity === 'admin' ? 'explorer' : 'admin')}
            title="Admin Dashboard (Platform Management)"
            style={{ color: activeActivity === 'admin' ? '#f43f5e' : '#a855f7' }}
          >
            <Shield size={22} />
          </button>
        )}
      </div>

      <div className="activity-bar-group">
        <button
          className="activity-btn"
          onClick={() => (isAuthenticated ? setAuthModalOpen(false) : setAuthModalOpen(true))}
          title={isAuthenticated ? `Account: ${user?.username} (${user?.role || 'user'})` : 'Sign In'}
        >
          {isAuthenticated && user ? (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                backgroundColor: user.avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {user.username.substring(0, 2).toUpperCase()}
            </div>
          ) : (
            <UserIcon size={22} />
          )}
        </button>

        <button
          className="activity-btn"
          onClick={() => setSettingsModalOpen(true)}
          title="Settings (Ctrl+,)"
        >
          <Settings size={22} />
        </button>
      </div>
    </aside>
  );
};
