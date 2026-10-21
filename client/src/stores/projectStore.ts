import { create } from 'zustand';
import { IProject, IFileNode } from '../types/ide.js';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';

interface ProjectState {
  projects: IProject[];
  currentProject: IProject | null;
  files: IFileNode[];
  activeFileId: string | null;
  isLoadingProjects: boolean;
  hasLoadedProjects: boolean;
  isLoadingFiles: boolean;
  sidebarWidth: number;
  activeActivity: string;

  setSidebarWidth: (width: number) => void;
  setActiveActivity: (activity: string) => void;
  loadProjects: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  loadFiles: (projectId: string) => Promise<void>;
  createProject: (data: { name: string; description?: string; template?: string; isPublic?: boolean }) => Promise<IProject>;
  deleteProject: (projectId: string) => Promise<void>;
  createFile: (parentId: string | null, name: string, content?: string) => Promise<IFileNode>;
  createFolder: (parentId: string | null, name: string) => Promise<IFileNode>;
  renameNode: (nodeId: string, newName: string) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  duplicateNode: (nodeId: string) => Promise<void>;
  saveFile: (fileId: string, content: string) => Promise<void>;
  setActiveFileId: (fileId: string | null) => void;
  handleRemoteFileCreated: (file: IFileNode) => void;
  handleRemoteFileSaved: (fileId: string, size: number) => void;
  handleRemoteFileRenamed: (file: IFileNode) => void;
  handleRemoteFileDeleted: (fileId: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  files: [],
  activeFileId: null,
  isLoadingProjects: false,
  hasLoadedProjects: false,
  isLoadingFiles: false,
  sidebarWidth: 260,
  activeActivity: 'explorer',

  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(width, 600)) }),
  setActiveActivity: (activeActivity) => set({ activeActivity }),

  loadProjects: async () => {
    set({ isLoadingProjects: true });
    try {
      const { projects } = await api.projects.list();
      set({ projects, isLoadingProjects: false, hasLoadedProjects: true });

      const savedProjectId = localStorage.getItem('collabide_current_project_id');
      const matchingProject = projects.find((p) => p.id === savedProjectId);

      if (matchingProject) {
        await get().selectProject(matchingProject.id);
      } else if (projects.length > 0 && !get().currentProject) {
        await get().selectProject(projects[0].id);
      }
    } catch {
      set({ isLoadingProjects: false, hasLoadedProjects: true });
    }
  },

  selectProject: async (projectId: string) => {
    try {
      localStorage.setItem('collabide_current_project_id', projectId);
      const { project } = await api.projects.get(projectId);
      set({ currentProject: project });
      socketService.joinProject(projectId);
      await get().loadFiles(projectId);
    } catch (err) {
      console.error('[Select Project Error]', err);
    }
  },

  loadFiles: async (projectId: string) => {
    set({ isLoadingFiles: true });
    try {
      const { files } = await api.files.getTree(projectId);
      set({ files, isLoadingFiles: false });
    } catch {
      set({ isLoadingFiles: false });
    }
  },

  createProject: async (data) => {
    const { project } = await api.projects.create(data);
    set((state) => ({ projects: [project, ...state.projects] }));
    await get().selectProject(project.id);
    return project;
  },

  deleteProject: async (projectId: string) => {
    await api.projects.delete(projectId);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
      files: state.currentProject?.id === projectId ? [] : state.files,
    }));
  },

  createFile: async (parentId, name, content) => {
    const projectId = get().currentProject?.id;
    if (!projectId) throw new Error('No project selected');
    const { file } = await api.files.createFile(projectId, { parentId, name, content });
    set((state) => ({ files: [...state.files, file] }));
    return file;
  },

  createFolder: async (parentId, name) => {
    const projectId = get().currentProject?.id;
    if (!projectId) throw new Error('No project selected');
    const { folder } = await api.files.createFolder(projectId, { parentId, name });
    set((state) => ({ files: [...state.files, folder] }));
    return folder;
  },

  renameNode: async (nodeId, newName) => {
    const projectId = get().currentProject?.id;
    if (!projectId) return;
    const { node } = await api.files.renameNode(projectId, nodeId, newName);
    set((state) => ({
      files: state.files.map((f) => (f.id === nodeId ? node : f)),
    }));
    await get().loadFiles(projectId);
  },

  deleteNode: async (nodeId) => {
    const projectId = get().currentProject?.id;
    if (!projectId) return;
    await api.files.deleteNode(projectId, nodeId);
    set((state) => ({
      files: state.files.filter((f) => f.id !== nodeId && !f.path.startsWith(`${f.path}/`)),
    }));
    await get().loadFiles(projectId);
  },

  duplicateNode: async (nodeId) => {
    const projectId = get().currentProject?.id;
    if (!projectId) return;
    const { file } = await api.files.duplicateNode(projectId, nodeId);
    set((state) => ({ files: [...state.files, file] }));
  },

  saveFile: async (fileId, content) => {
    const projectId = get().currentProject?.id;
    if (!projectId) return;
    const { file } = await api.files.saveFile(projectId, fileId, content);
    set((state) => ({
      files: state.files.map((f) => (f.id === fileId ? file : f)),
    }));
  },

  setActiveFileId: (activeFileId) => set({ activeFileId }),

  handleRemoteFileCreated: (file) => {
    set((state) => {
      if (state.files.some((f) => f.id === file.id)) return state;
      return { files: [...state.files, file] };
    });
  },

  handleRemoteFileSaved: (fileId, size) => {
    set((state) => ({
      files: state.files.map((f) => (f.id === fileId ? { ...f, size } : f)),
    }));
  },

  handleRemoteFileRenamed: (file) => {
    set((state) => ({
      files: state.files.map((f) => (f.id === file.id ? file : f)),
    }));
  },

  handleRemoteFileDeleted: (fileId) => {
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
    }));
  },
}));
