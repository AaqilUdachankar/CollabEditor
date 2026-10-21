import { create } from 'zustand';
import { ISettings } from '../types/ide.js';

interface SettingsState {
  settings: ISettings;
  commandPaletteOpen: boolean;
  quickOpenOpen: boolean;
  newProjectModalOpen: boolean;
  inviteModalOpen: boolean;
  settingsModalOpen: boolean;
  authModalOpen: boolean;

  updateSettings: (partial: Partial<ISettings>) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickOpenOpen: (open: boolean) => void;
  setNewProjectModalOpen: (open: boolean) => void;
  setInviteModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
}

const defaultSettings: ISettings = {
  theme: 'vs-dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  autoSave: true,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    ...defaultSettings,
    ...(JSON.parse(localStorage.getItem('collabide_settings') || localStorage.getItem('nexus_settings') || '{}')),
  },
  commandPaletteOpen: false,
  quickOpenOpen: false,
  newProjectModalOpen: false,
  inviteModalOpen: false,
  settingsModalOpen: false,
  authModalOpen: false,

  updateSettings: (partial) => {
    set((state) => {
      const updated = { ...state.settings, ...partial };
      localStorage.setItem('collabide_settings', JSON.stringify(updated));
      return { settings: updated };
    });
  },

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setQuickOpenOpen: (quickOpenOpen) => set({ quickOpenOpen }),
  setNewProjectModalOpen: (newProjectModalOpen) => set({ newProjectModalOpen }),
  setInviteModalOpen: (inviteModalOpen) => set({ inviteModalOpen }),
  setSettingsModalOpen: (settingsModalOpen) => set({ settingsModalOpen }),
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),
}));
