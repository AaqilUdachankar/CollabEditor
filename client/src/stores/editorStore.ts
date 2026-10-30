import { create } from 'zustand';
import { ITab, IFileNode } from '../types/ide.js';

interface EditorState {
  tabs: ITab[];
  activeTabId: string | null;
  splitMode: 'none' | 'vertical' | 'horizontal';
  splitTabs: ITab[];
  activeSplitTabId: string | null;

  openTab: (file: IFileNode) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  setTabDirty: (fileId: string, isDirty: boolean) => void;
  setSplitMode: (mode: 'none' | 'vertical' | 'horizontal') => void;
  openInSplit: (file: IFileNode) => void;
  closeSplitTab: (tabId: string) => void;
  setActiveSplitTab: (tabId: string) => void;
  targetLocation: {
    fileId: string;
    lineNumber: number;
    matchStart?: number;
    matchEnd?: number;
    colStart?: number;
    colEnd?: number;
    nonce: number;
  } | null;
  navigateToLocation: (
    file: IFileNode,
    lineNumber: number,
    matchStart?: number,
    matchEnd?: number,
    colStart?: number,
    colEnd?: number
  ) => void;
  clearTargetLocation: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  splitMode: 'none',
  splitTabs: [],
  activeSplitTabId: null,
  targetLocation: null,

  navigateToLocation: (
    file: IFileNode,
    lineNumber: number,
    matchStart?: number,
    matchEnd?: number,
    colStart?: number,
    colEnd?: number
  ) => {
    get().openTab(file);
    set({
      targetLocation: {
        fileId: file.id,
        lineNumber,
        matchStart,
        matchEnd,
        colStart,
        colEnd,
        nonce: Date.now(),
      },
    });
  },

  clearTargetLocation: () => set({ targetLocation: null }),

  openTab: (file: IFileNode) => {
    if (file.type !== 'file') return;

    const existing = get().tabs.find((t) => t.fileId === file.id);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    const newTab: ITab = {
      id: `tab-${file.id}`,
      fileId: file.id,
      title: file.name,
      path: file.path,
      language: file.language || 'plaintext',
      isDirty: false,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const remaining = tabs.filter((t) => t.id !== tabId);
    let nextActive = activeTabId;

    if (activeTabId === tabId) {
      if (remaining.length === 0) {
        nextActive = null;
      } else if (index < remaining.length) {
        nextActive = remaining[index].id;
      } else {
        nextActive = remaining[remaining.length - 1].id;
      }
    }

    set({ tabs: remaining, activeTabId: nextActive });
  },

  closeOtherTabs: (tabId: string) => {
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === tabId),
      activeTabId: tabId,
    }));
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
  },

  setActiveTab: (activeTabId: string) => {
    set({ activeTabId });
  },

  setTabDirty: (fileId: string, isDirty: boolean) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.fileId === fileId ? { ...t, isDirty } : t)),
    }));
  },

  setSplitMode: (splitMode) => {
    set({ splitMode });
  },

  openInSplit: (file: IFileNode) => {
    if (file.type !== 'file') return;

    const existing = get().splitTabs.find((t) => t.fileId === file.id);
    if (existing) {
      set({ activeSplitTabId: existing.id, splitMode: 'vertical' });
      return;
    }

    const newTab: ITab = {
      id: `splittab-${file.id}`,
      fileId: file.id,
      title: file.name,
      path: file.path,
      language: file.language || 'plaintext',
      isDirty: false,
    };

    set((state) => ({
      splitTabs: [...state.splitTabs, newTab],
      activeSplitTabId: newTab.id,
      splitMode: 'vertical',
    }));
  },

  closeSplitTab: (tabId: string) => {
    const { splitTabs, activeSplitTabId } = get();
    const remaining = splitTabs.filter((t) => t.id !== tabId);
    let nextActive = activeSplitTabId;

    if (activeSplitTabId === tabId) {
      nextActive = remaining.length > 0 ? remaining[0].id : null;
    }

    set({
      splitTabs: remaining,
      activeSplitTabId: nextActive,
      splitMode: remaining.length === 0 ? 'none' : get().splitMode,
    });
  },

  setActiveSplitTab: (activeSplitTabId) => {
    set({ activeSplitTabId });
  },
}));
