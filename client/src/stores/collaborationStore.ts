import { create } from 'zustand';
import { ICollaboratorPresence } from '../types/ide.js';

interface CollabState {
  collaborators: ICollaboratorPresence[];
  isConnected: boolean;
  activeCollaborator: ICollaboratorPresence | null;
  setCollaborators: (users: ICollaboratorPresence[]) => void;
  setIsConnected: (connected: boolean) => void;
  updateUserActivity: (data: Partial<ICollaboratorPresence> & { socketId: string }) => void;
  setActiveCollaborator: (user: ICollaboratorPresence | null) => void;
}

export const useCollaborationStore = create<CollabState>((set) => ({
  collaborators: [],
  isConnected: true,
  activeCollaborator: null,

  setCollaborators: (collaborators) => set({ collaborators }),
  setIsConnected: (isConnected) => set({ isConnected }),

  updateUserActivity: (data) => {
    set((state) => ({
      collaborators: state.collaborators.map((c) =>
        c.socketId === data.socketId ? { ...c, ...data } : c
      ),
    }));
  },

  setActiveCollaborator: (activeCollaborator) => set({ activeCollaborator }),
}));
