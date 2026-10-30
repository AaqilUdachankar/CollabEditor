import { create } from 'zustand';
import { IFileVersion, IFileNode } from '../types/ide.js';
import { api } from '../services/api.js';

interface HistoryState {
  isOpen: boolean;
  activeFile: IFileNode | null;
  projectId: string | null;
  versions: IFileVersion[];
  total: number;
  selectedVersionId: string | null;
  compareVersionId: string; // 'current' or version id
  originalContent: string;
  modifiedContent: string;
  diffSummary: { addedCount: number; removedCount: number; unchangedCount: number } | null;
  diffLines: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string; oldLineNumber?: number; newLineNumber?: number }>;
  viewMode: 'diff' | 'preview';
  isLoading: boolean;
  isDiffLoading: boolean;
  isRestoring: boolean;
  error: string | null;
  permissionDenied: boolean;
  confirmRestoreVersion: IFileVersion | null;

  openHistory: (file: IFileNode, projectId: string) => Promise<void>;
  closeHistory: () => void;
  loadVersions: () => Promise<void>;
  selectVersion: (versionId: string) => Promise<void>;
  setCompareVersion: (compareVersionId: string) => Promise<void>;
  loadDiff: (v1Id: string, v2Id: string) => Promise<void>;
  setViewMode: (viewMode: 'diff' | 'preview') => void;
  requestRestore: (version: IFileVersion) => void;
  cancelRestore: () => void;
  confirmRestore: (onSuccess?: (file: IFileNode) => void) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  isOpen: false,
  activeFile: null,
  projectId: null,
  versions: [],
  total: 0,
  selectedVersionId: null,
  compareVersionId: 'current',
  originalContent: '',
  modifiedContent: '',
  diffSummary: null,
  diffLines: [],
  viewMode: 'diff',
  isLoading: false,
  isDiffLoading: false,
  isRestoring: false,
  error: null,
  permissionDenied: false,
  confirmRestoreVersion: null,

  openHistory: async (file: IFileNode, projectId: string) => {
    set({
      isOpen: true,
      activeFile: file,
      projectId,
      versions: [],
      total: 0,
      selectedVersionId: null,
      compareVersionId: 'current',
      originalContent: '',
      modifiedContent: '',
      diffSummary: null,
      diffLines: [],
      viewMode: 'diff',
      isLoading: true,
      error: null,
      permissionDenied: false,
      confirmRestoreVersion: null,
    });

    await get().loadVersions();
  },

  closeHistory: () => {
    set({
      isOpen: false,
      activeFile: null,
      projectId: null,
      versions: [],
      selectedVersionId: null,
      confirmRestoreVersion: null,
      error: null,
    });
  },

  loadVersions: async () => {
    const { activeFile, projectId } = get();
    if (!activeFile || !projectId) return;

    set({ isLoading: true, error: null, permissionDenied: false });
    try {
      const data = await api.history.list(projectId, activeFile.id, 50, 0);
      const versions = data.versions;
      const total = data.total;

      const defaultSelected = versions.length > 0 ? versions[0].id : null;
      set({
        versions,
        total,
        selectedVersionId: defaultSelected,
        isLoading: false,
      });

      if (defaultSelected) {
        await get().loadDiff(defaultSelected, get().compareVersionId);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to load versions';
      const isPerm = msg.includes('403') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('forbidden');
      set({
        isLoading: false,
        error: isPerm ? 'Permission denied: Workspace membership required to view file history.' : msg,
        permissionDenied: isPerm,
      });
    }
  },

  selectVersion: async (versionId: string) => {
    set({ selectedVersionId: versionId });
    await get().loadDiff(versionId, get().compareVersionId);
  },

  setCompareVersion: async (compareVersionId: string) => {
    set({ compareVersionId });
    const { selectedVersionId } = get();
    if (selectedVersionId) {
      await get().loadDiff(selectedVersionId, compareVersionId);
    }
  },

  loadDiff: async (v1Id: string, v2Id: string) => {
    const { activeFile, projectId, versions } = get();
    if (!activeFile || !projectId) return;

    set({ isDiffLoading: true, error: null });
    try {
      // v1 is the selected historical version
      // v2 is compared against ('current' or another historical version)
      const data = await api.history.diff(projectId, activeFile.id, v1Id, v2Id);
      set({
        originalContent: data.originalContent,
        modifiedContent: data.modifiedContent,
        diffSummary: {
          addedCount: data.diff.addedCount,
          removedCount: data.diff.removedCount,
          unchangedCount: data.diff.unchangedCount,
        },
        diffLines: data.diff.lines,
        isDiffLoading: false,
      });
    } catch (err: any) {
      // Fallback: use local version content if diff API fails
      const ver1 = versions.find((v) => v.id === v1Id);
      const orig = ver1 ? ver1.content : '';
      const mod = activeFile.content || '';
      set({
        originalContent: orig,
        modifiedContent: mod,
        isDiffLoading: false,
        error: err.message || 'Error loading diff',
      });
    }
  },

  setViewMode: (viewMode) => set({ viewMode }),

  requestRestore: (version: IFileVersion) => {
    set({ confirmRestoreVersion: version });
  },

  cancelRestore: () => {
    set({ confirmRestoreVersion: null });
  },

  confirmRestore: async (onSuccess) => {
    const { confirmRestoreVersion, activeFile, projectId } = get();
    if (!confirmRestoreVersion || !activeFile || !projectId) return;

    set({ isRestoring: true, error: null });
    try {
      const res = await api.history.restore(projectId, activeFile.id, confirmRestoreVersion.id);

      // Re-fetch versions to include the newly created restore snapshot
      await get().loadVersions();

      set({
        confirmRestoreVersion: null,
        isRestoring: false,
      });

      if (onSuccess && res.file) {
        onSuccess(res.file);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to restore version';
      const isPerm = msg.includes('403') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('role');
      set({
        isRestoring: false,
        error: isPerm ? 'Permission denied: Edit role required to restore file versions.' : msg,
        permissionDenied: isPerm,
        confirmRestoreVersion: null,
      });
    }
  },
}));
