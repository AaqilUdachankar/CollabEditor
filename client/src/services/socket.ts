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
};
