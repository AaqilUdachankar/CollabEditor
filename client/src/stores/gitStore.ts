import { create } from 'zustand';
import { IGitStatus, IGitCommit } from '../types/ide.js';
import { api } from '../services/api.js';

interface GitState {
  status: IGitStatus | null;
  commits: IGitCommit[];
  activeDiff: { file: string; diffText: string; staged?: boolean } | null;
  isLoading: boolean;
  isCommitting: boolean;
  error: string | null;
  gitAvailable: boolean;

  loadStatus: (projectId: string) => Promise<void>;
  loadHistory: (projectId: string) => Promise<void>;
  initRepo: (projectId: string) => Promise<void>;
  stageFile: (projectId: string, filePath: string) => Promise<void>;
  stageAll: (projectId: string) => Promise<void>;
  unstageFile: (projectId: string, filePath: string) => Promise<void>;
  commit: (projectId: string, message: string) => Promise<void>;
  loadDiff: (projectId: string, file?: string, staged?: boolean) => Promise<void>;
  closeDiff: () => void;
  createBranch: (projectId: string, branchName: string) => Promise<void>;
  clearError: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  commits: [],
  activeDiff: null,
  isLoading: false,
  isCommitting: false,
  error: null,
  gitAvailable: true,

  loadStatus: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      const status = await api.git.getStatus(projectId);
      set({
        status,
        gitAvailable: status.gitAvailable !== false,
        isLoading: false,
        error: status.error || null,
      });
    } catch (err: any) {
      set({
        error: err.message || 'Failed to load git status',
        isLoading: false,
      });
    }
  },

  loadHistory: async (projectId: string) => {
    try {
      const { commits } = await api.git.getHistory(projectId);
      set({ commits: commits || [] });
    } catch {
      // ignore history load error if repo uninitialized
    }
  },

  initRepo: async (projectId: string) => {
    try {
      set({ isLoading: true, error: null });
      await api.git.initRepo(projectId);
      await get().loadStatus(projectId);
      await get().loadHistory(projectId);
    } catch (err: any) {
      set({ error: err.message || 'Failed to initialize git repository', isLoading: false });
    }
  },

  stageFile: async (projectId: string, filePath: string) => {
    try {
      set({ error: null });
      await api.git.stageFile(projectId, filePath);
      await get().loadStatus(projectId);
    } catch (err: any) {
      set({ error: err.message || 'Failed to stage file' });
    }
  },

  stageAll: async (projectId: string) => {
    try {
      set({ error: null });
      await api.git.stageFile(projectId, '.');
      await get().loadStatus(projectId);
    } catch (err: any) {
      set({ error: err.message || 'Failed to stage changes' });
    }
  },

  unstageFile: async (projectId: string, filePath: string) => {
    try {
      set({ error: null });
      await api.git.unstageFile(projectId, filePath);
      await get().loadStatus(projectId);
    } catch (err: any) {
      set({ error: err.message || 'Failed to unstage file' });
    }
  },

  commit: async (projectId: string, message: string) => {
    if (!message || !message.trim()) {
      set({ error: 'Commit message is required' });
      return;
    }

    try {
      set({ isCommitting: true, error: null });
      await api.git.commit(projectId, message.trim());
      await get().loadStatus(projectId);
      await get().loadHistory(projectId);
    } catch (err: any) {
      set({ error: err.message || 'Failed to commit changes' });
      throw err;
    } finally {
      set({ isCommitting: false });
    }
  },

  loadDiff: async (projectId: string, file?: string, staged: boolean = false) => {
    try {
      set({ error: null });
      const { diff } = await api.git.getDiff(projectId, file, staged);
      set({
        activeDiff: {
          file: file || (staged ? 'Staged Changes' : 'Working Tree'),
          diffText: diff || '',
          staged,
        },
      });
    } catch (err: any) {
      console.error('[Load Diff Error]', err);
      set({ error: err.message || 'Failed to retrieve diff' });
    }
  },

  closeDiff: () => set({ activeDiff: null }),

  createBranch: async (projectId: string, branchName: string) => {
    try {
      set({ error: null });
      await api.git.createBranch(projectId, branchName);
      await get().loadStatus(projectId);
    } catch (err: any) {
      set({ error: err.message || 'Failed to create branch' });
    }
  },

  clearError: () => set({ error: null }),
}));
