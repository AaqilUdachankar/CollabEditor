import { create } from 'zustand';
import { IGitStatus, IGitCommit } from '../types/ide.js';
import { api } from '../services/api.js';

interface GitState {
  status: IGitStatus | null;
  commits: IGitCommit[];
  activeDiff: { file: string; diffText: string } | null;
  isLoading: boolean;
  error: string | null;

  loadStatus: (projectId: string) => Promise<void>;
  loadHistory: (projectId: string) => Promise<void>;
  initRepo: (projectId: string) => Promise<void>;
  stageFile: (projectId: string, filePath: string) => Promise<void>;
  unstageFile: (projectId: string, filePath: string) => Promise<void>;
  commit: (projectId: string, message: string) => Promise<void>;
  loadDiff: (projectId: string, file?: string) => Promise<void>;
  closeDiff: () => void;
  createBranch: (projectId: string, branchName: string) => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  commits: [],
  activeDiff: null,
  isLoading: false,
  error: null,

  loadStatus: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      const status = await api.git.getStatus(projectId);
      set({ status, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  loadHistory: async (projectId: string) => {
    try {
      const { commits } = await api.git.getHistory(projectId);
      set({ commits });
    } catch {
      // ignore
    }
  },

  initRepo: async (projectId: string) => {
    await api.git.initRepo(projectId);
    await get().loadStatus(projectId);
  },

  stageFile: async (projectId: string, filePath: string) => {
    await api.git.stageFile(projectId, filePath);
    await get().loadStatus(projectId);
  },

  unstageFile: async (projectId: string, filePath: string) => {
    await api.git.unstageFile(projectId, filePath);
    await get().loadStatus(projectId);
  },

  commit: async (projectId: string, message: string) => {
    await api.git.commit(projectId, message);
    await get().loadStatus(projectId);
    await get().loadHistory(projectId);
  },

  loadDiff: async (projectId: string, file?: string) => {
    try {
      const { diff } = await api.git.getDiff(projectId, file);
      set({ activeDiff: { file: file || 'Working Tree', diffText: diff } });
    } catch (err: any) {
      console.error('[Load Diff Error]', err);
    }
  },

  closeDiff: () => set({ activeDiff: null }),

  createBranch: async (projectId: string, branchName: string) => {
    await api.git.createBranch(projectId, branchName);
    await get().loadStatus(projectId);
  },
}));
