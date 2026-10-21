import { create } from 'zustand';
import { PanelTab } from '../types/ide.js';

export interface OutputLog {
  id: string;
  time: string;
  text: string;
  type?: 'info' | 'error' | 'success';
}

export interface ProblemItem {
  file: string;
  line: number;
  col: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface TerminalState {
  isOpen: boolean;
  activeTab: PanelTab;
  height: number;
  outputLogs: OutputLog[];
  problems: ProblemItem[];

  togglePanel: () => void;
  openPanel: (tab?: PanelTab) => void;
  closePanel: () => void;
  setActiveTab: (tab: PanelTab) => void;
  setHeight: (height: number) => void;
  addOutputLog: (text: string, type?: 'info' | 'error' | 'success') => void;
  clearOutput: () => void;
  setProblems: (problems: ProblemItem[]) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  activeTab: 'terminal',
  height: 220,
  outputLogs: [],
  problems: [],

  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
  openPanel: (tab) => set((state) => ({ isOpen: true, activeTab: tab || state.activeTab })),
  closePanel: () => set({ isOpen: false }),
  setActiveTab: (activeTab) => set({ activeTab, isOpen: true }),
  setHeight: (height) => set({ height: Math.max(120, Math.min(height, 600)) }),

  addOutputLog: (text, type = 'info') => {
    const log: OutputLog = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      text,
      type,
    };
    set((state) => ({ outputLogs: [...state.outputLogs, log] }));
  },

  clearOutput: () => set({ outputLogs: [] }),
  setProblems: (problems) => set({ problems }),
}));
