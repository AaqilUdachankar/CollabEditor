import React, { useEffect } from 'react';
import { TopMenuBar } from './components/menubar/TopMenuBar.js';
import { ActivityBar } from './components/activitybar/ActivityBar.js';
import { SidebarContainer } from './components/sidebar/SidebarContainer.js';
import { EditorWorkbench } from './components/editor/EditorWorkbench.js';
import { BottomPanel } from './components/panel/BottomPanel.js';
import { StatusBar } from './components/statusbar/StatusBar.js';
import { CommandPalette } from './components/commandpalette/CommandPalette.js';
import { QuickOpen } from './components/commandpalette/QuickOpen.js';
import { NewProjectModal } from './components/modals/NewProjectModal.js';
import { InviteModal } from './components/modals/InviteModal.js';
import { SettingsModal } from './components/modals/SettingsModal.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { VideoCallModal } from './components/videocall/VideoCallModal.js';
import { IncomingCallBanner } from './components/videocall/IncomingCallBanner.js';
import { IncomingWhiteboardBanner } from './components/whiteboard/IncomingWhiteboardBanner.js';
import { WhiteboardWorkbench } from './components/whiteboard/WhiteboardWorkbench.js';
import { useAuthStore } from './stores/authStore.js';
import { useProjectStore } from './stores/projectStore.js';
import { useCollaborationStore } from './stores/collaborationStore.js';
import { useSettingsStore } from './stores/settingsStore.js';
import { useVideoCallStore } from './stores/videoCallStore.js';
import { useWhiteboardStore } from './stores/whiteboardStore.js';
import { webrtcService } from './services/webrtcService.js';
import { socketService } from './services/socket.js';
import { api } from './services/api.js';

export const App: React.FC = () => {
  const { loadMe, isAuthenticated } = useAuthStore();
  const {
    currentProject,
    projects,
    isLoadingProjects,
    hasLoadedProjects,
    loadProjects,
    selectProject,
    createProject,
    handleRemoteFileCreated,
    handleRemoteFileSaved,
    handleRemoteFileRenamed,
    handleRemoteFileDeleted,
    setActiveActivity,
  } = useProjectStore();
  const { setCollaborators, updateUserActivity } = useCollaborationStore();
  const { setNewProjectModalOpen } = useSettingsStore();

  // 1. Initial auth check
  useEffect(() => {
    loadMe();
  }, []);

  // 2. Load projects and process invite tokens
  useEffect(() => {
    if (!isAuthenticated) return;

    async function init() {
      // Check for invite token in URL hash: #invite=token
      const hash = window.location.hash;
      if (hash.includes('invite=')) {
        const token = hash.split('invite=')[1]?.split('&')[0];
        if (token) {
          try {
            const res = await api.collaboration.joinByToken(token);
            await selectProject(res.projectId);
            window.location.hash = '';
            return;
          } catch (err: any) {
            console.warn('[Invite Join Warning]', err.message);
          }
        }
      }

      await loadProjects();
    }
    init();
  }, [isAuthenticated]);

  // 3. Auto-select or create ONLY IF project list has finished loading and is truly empty
  useEffect(() => {
    if (!isAuthenticated || !hasLoadedProjects || isLoadingProjects) return;

    if (!currentProject) {
      if (projects.length > 0) {
        const savedId = localStorage.getItem('collabide_current_project_id');
        const match = projects.find((p) => p.id === savedId) || projects[0];
        selectProject(match.id);
      } else {
        // Auto-create initial starter project ONLY if the user has 0 projects
        createProject({
          name: 'My Workspace',
          description: 'A full-stack collaborative workspace',
          template: 'vanilla',
          isPublic: true,
        });
      }
    }
  }, [hasLoadedProjects, isLoadingProjects, projects.length, currentProject?.id, isAuthenticated]);

  // 4. Bind real-time socket listeners
  useEffect(() => {
    const unsubPresence = socketService.onPresenceUpdate(({ users }) => {
      setCollaborators(users);
    });

    const unsubActivity = socketService.onPresenceActivity((activity) => {
      updateUserActivity(activity);
    });

    const unsubFileCreated = socketService.onFileCreated(({ file }) => {
      handleRemoteFileCreated(file);
    });

    const unsubFileSaved = socketService.onFileSaved(({ fileId, size }) => {
      handleRemoteFileSaved(fileId, size);
    });

    const unsubFileRenamed = socketService.onFileRenamed(({ file }) => {
      handleRemoteFileRenamed(file);
    });

    const unsubFileDeleted = socketService.onFileDeleted(({ fileId }) => {
      handleRemoteFileDeleted(fileId);
    });

    // 1-to-1 Private Video Calling Socket Listeners
    const unsubCallIncoming = socketService.onCallIncoming((data) => {
      useVideoCallStore.getState().handleIncomingCall(data);
    });

    const unsubCallAccept = socketService.onCallAccept(async (data) => {
      const store = useVideoCallStore.getState();
      if (store.callId === data.callId && data.responderId) {
        store.addPeer({
          userId: data.responderId,
          username: data.responderName || 'Teammate',
          avatarColor: data.avatarColor || '#10b981',
        });
        // Create WebRTC connection with this peer
        webrtcService.initPeerConnection(data.callId, data.responderId);
        await webrtcService.createOffer(data.callId, data.responderId);
      } else if (store.peer) {
        await webrtcService.createOffer(data.callId, store.peer.userId);
      }
    });

    const unsubCallReject = socketService.onCallReject((data) => {
      alert(`Call declined: ${data.reason || 'User busy'}`);
      useVideoCallStore.getState().clearCall();
    });

    const unsubCallOffer = socketService.onCallOffer(async (data) => {
      await webrtcService.handleOffer(data.callId, data.callerId, data.sdp);
    });

    const unsubCallAnswer = socketService.onCallAnswer(async (data) => {
      await webrtcService.handleAnswer(data.sdp, data.responderId);
    });

    const unsubCallIce = socketService.onCallIceCandidate(async (data) => {
      await webrtcService.addIceCandidate(data.candidate, data.senderId);
    });

    const unsubCallEnd = socketService.onCallEnd(() => {
      useVideoCallStore.getState().endCall();
    });

    // Private Miro-Style Whiteboard Socket Listeners
    const unsubBoardIncoming = socketService.onBoardIncoming((data) => {
      useWhiteboardStore.getState().handleIncomingInvite(data);
    });

    const unsubBoardReject = socketService.onBoardReject((data) => {
      alert(`Whiteboard invitation declined: ${data.reason || 'Declined'}`);
    });

    const unsubBoardOp = socketService.onBoardOperation((data) => {
      useWhiteboardStore.getState().applyRemoteOperation(data.operation);
    });

    const unsubBoardSync = socketService.onBoardSync((data) => {
      useWhiteboardStore.getState().syncRemoteCanvas(data.canvasData?.elements);
    });

    const unsubBoardCursor = socketService.onBoardCursor((data) => {
      useWhiteboardStore.getState().updatePeerCursor(data);
    });

    return () => {
      unsubPresence();
      unsubActivity();
      unsubFileCreated();
      unsubFileSaved();
      unsubFileRenamed();
      unsubFileDeleted();
      unsubCallIncoming();
      unsubCallAccept();
      unsubCallReject();
      unsubCallOffer();
      unsubCallAnswer();
      unsubCallIce();
      unsubCallEnd();
      unsubBoardIncoming();
      unsubBoardReject();
      unsubBoardOp();
      unsubBoardSync();
      unsubBoardCursor();
    };
  }, []);

  // 5. Global shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setActiveActivity('search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="nexus-app">
      {/* Top Menu Bar */}
      <TopMenuBar />

      {/* Main Body */}
      <div className="nexus-body">
        {/* Activity Bar (48px) */}
        <ActivityBar />

        {/* Resizable Sidebar */}
        <SidebarContainer />

        {/* Workbench Center Area */}
        <div className="nexus-workbench-center">
          <EditorWorkbench />
          <BottomPanel />
        </div>
      </div>

      {/* Status Bar (22px) */}
      <StatusBar />

      {/* Modals & Overlays */}
      <CommandPalette />
      <QuickOpen />
      <NewProjectModal />
      <InviteModal />
      <SettingsModal />
      <AuthModal />

      {/* Private Video Calling & Miro Whiteboard Overlays */}
      <VideoCallModal />
      <IncomingCallBanner />
      <IncomingWhiteboardBanner />
      <WhiteboardWorkbench />
    </div>
  );
};

export default App;
