import { io, Socket } from 'socket.io-client';
import { ICollaboratorPresence } from '../types/ide.js';

let socketInstance: Socket | null = null;

export function getSocket(): Socket | null {
  return socketInstance;
}

export function initSocket(token: string): Socket {
  if (socketInstance) {
    socketInstance.disconnect();
  }

  socketInstance = io(window.location.origin, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socketInstance.on('connect', () => {
    console.log('[Socket.IO] Connected as socket ID:', socketInstance?.id);
  });

  socketInstance.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export const socketService = {
  joinProject(projectId: string, avatarColor?: string) {
    if (!socketInstance) return;
    if (socketInstance.connected) {
      socketInstance.emit('join:project', { projectId, avatarColor });
    } else {
      socketInstance.once('connect', () => {
        socketInstance?.emit('join:project', { projectId, avatarColor });
      });
    }
  },

  leaveProject(projectId: string) {
    if (socketInstance?.connected) {
      socketInstance.emit('leave:project', { projectId });
    }
  },

  sendActivity(projectId: string, data: { fileId: string | null; filePath: string | null; cursorLine: number; cursorCol: number }) {
    if (socketInstance?.connected) {
      socketInstance.emit('presence:activity', { projectId, ...data });
    }
  },

  onPresenceUpdate(callback: (data: { projectId: string; users: ICollaboratorPresence[] }) => void) {
    socketInstance?.on('presence:update', callback);
    return () => {
      socketInstance?.off('presence:update', callback);
    };
  },

  onPresenceActivity(callback: (activity: any) => void) {
    socketInstance?.on('presence:activity', callback);
    return () => {
      socketInstance?.off('presence:activity', callback);
    };
  },

  onFileCreated(callback: (data: { file: any }) => void) {
    socketInstance?.on('file:created', callback);
    return () => {
      socketInstance?.off('file:created', callback);
    };
  },

  onFileSaved(callback: (data: { fileId: string; size: number }) => void) {
    socketInstance?.on('file:saved', callback);
    return () => {
      socketInstance?.off('file:saved', callback);
    };
  },

  onFileRenamed(callback: (data: { file: any }) => void) {
    socketInstance?.on('file:renamed', callback);
    return () => {
      socketInstance?.off('file:renamed', callback);
    };
  },

  onFileDeleted(callback: (data: { fileId: string }) => void) {
    socketInstance?.on('file:deleted', callback);
    return () => {
      socketInstance?.off('file:deleted', callback);
    };
  },

  // Video Call Real-time Listeners
  onCallIncoming(callback: (data: any) => void) {
    socketInstance?.on('call:incoming', callback);
    return () => {
      socketInstance?.off('call:incoming', callback);
    };
  },

  onCallAccept(callback: (data: any) => void) {
    socketInstance?.on('call:accept', callback);
    return () => {
      socketInstance?.off('call:accept', callback);
    };
  },

  onCallReject(callback: (data: any) => void) {
    socketInstance?.on('call:reject', callback);
    return () => {
      socketInstance?.off('call:reject', callback);
    };
  },

  onCallOffer(callback: (data: any) => void) {
    socketInstance?.on('call:offer', callback);
    return () => {
      socketInstance?.off('call:offer', callback);
    };
  },

  onCallAnswer(callback: (data: any) => void) {
    socketInstance?.on('call:answer', callback);
    return () => {
      socketInstance?.off('call:answer', callback);
    };
  },

  onCallIceCandidate(callback: (data: any) => void) {
    socketInstance?.on('call:ice-candidate', callback);
    return () => {
      socketInstance?.off('call:ice-candidate', callback);
    };
  },

  onCallEnd(callback: (data: any) => void) {
    socketInstance?.on('call:end', callback);
    return () => {
      socketInstance?.off('call:end', callback);
    };
  },

  // Whiteboard Real-time Listeners
  onBoardIncoming(callback: (data: any) => void) {
    socketInstance?.on('board:incoming', callback);
    return () => {
      socketInstance?.off('board:incoming', callback);
    };
  },

  onBoardReject(callback: (data: any) => void) {
    socketInstance?.on('board:reject', callback);
    return () => {
      socketInstance?.off('board:reject', callback);
    };
  },

  onBoardOperation(callback: (data: any) => void) {
    socketInstance?.on('board:operation', callback);
    return () => {
      socketInstance?.off('board:operation', callback);
    };
  },

  onBoardSync(callback: (data: any) => void) {
    socketInstance?.on('board:sync', callback);
    return () => {
      socketInstance?.off('board:sync', callback);
    };
  },

  onBoardCursor(callback: (data: any) => void) {
    socketInstance?.on('board:cursor', callback);
    return () => {
      socketInstance?.off('board:cursor', callback);
    };
  },
};
