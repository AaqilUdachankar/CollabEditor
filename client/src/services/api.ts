import {
  IUser,
  IProject,
  IFileNode,
  IGitStatus,
  IGitCommit,
  IFileVersion,
  ISearchResult,
  IActivityRecord,
  IAdminOverview,
  IAdminUser,
  IAdminWorkspace,
  ILiveSessionWorkspace,
  IPerformanceData,
  IAuditRecord,
} from '../types/ide.js';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('collabide_token') || localStorage.getItem('nexus_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  auth: {
    signup: (data: { email: string; username: string; password: string }) =>
      request<{ user: IUser; token: string }>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      request<{ user: IUser; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    guest: () => request<{ user: IUser; token: string }>('/auth/guest', { method: 'POST' }),

    me: () => request<{ user: IUser }>('/auth/me'),

    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  },

  // Projects
  projects: {
    list: () => request<{ projects: IProject[] }>('/projects'),

    get: (projectId: string) => request<{ project: IProject }>(`/projects/${projectId}`),

    create: (data: { name: string; description?: string; template?: string; isPublic?: boolean }) =>
      request<{ project: IProject }>('/projects', { method: 'POST', body: JSON.stringify(data) }),

    update: (projectId: string, data: Partial<IProject>) =>
      request<{ project: IProject }>(`/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (projectId: string) => request<{ message: string }>(`/projects/${projectId}`, { method: 'DELETE' }),

    exportUrl: (projectId: string) => `/api/projects/${projectId}/export`,
  },

  // Files
  files: {
    getTree: (projectId: string) => request<{ files: IFileNode[] }>(`/projects/${projectId}/files`),

    createFile: (projectId: string, data: { parentId: string | null; name: string; content?: string }) =>
      request<{ file: IFileNode }>(`/projects/${projectId}/files`, { method: 'POST', body: JSON.stringify(data) }),

    createFolder: (projectId: string, data: { parentId: string | null; name: string }) =>
      request<{ folder: IFileNode }>(`/projects/${projectId}/folders`, { method: 'POST', body: JSON.stringify(data) }),

    saveFile: (projectId: string, fileId: string, content: string) =>
      request<{ file: IFileNode }>(`/projects/${projectId}/files/${fileId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),

    renameNode: (projectId: string, nodeId: string, newName: string) =>
      request<{ node: IFileNode }>(`/projects/${projectId}/nodes/${nodeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ newName }),
      }),

    deleteNode: (projectId: string, nodeId: string) =>
      request<{ success: boolean }>(`/projects/${projectId}/nodes/${nodeId}`, { method: 'DELETE' }),

    duplicateNode: (projectId: string, nodeId: string) =>
      request<{ file: IFileNode }>(`/projects/${projectId}/nodes/${nodeId}/duplicate`, { method: 'POST' }),

    search: (
      projectId: string,
      query: string,
      opts: { matchCase?: boolean; wholeWord?: boolean; isRegex?: boolean; limit?: number } = {}
    ) => {
      const params = new URLSearchParams({
        q: query,
        matchCase: String(opts.matchCase || false),
        wholeWord: String(opts.wholeWord || false),
        isRegex: String(opts.isRegex || false),
      });
      if (opts.limit) params.set('limit', String(opts.limit));
      return request<{ results: ISearchResult[]; totalMatches?: number; hasMore?: boolean }>(
        `/projects/${projectId}/search?${params.toString()}`
      );
    },
  },

  // History & Diff
  history: {
    list: (projectId: string, fileId: string, limit: number = 30, skip: number = 0) =>
      request<{ versions: IFileVersion[]; total: number }>(
        `/projects/${projectId}/files/${fileId}/history?limit=${limit}&skip=${skip}`
      ),

    get: (projectId: string, fileId: string, versionId: string) =>
      request<{ version: IFileVersion }>(`/projects/${projectId}/files/${fileId}/history/${versionId}`),

    diff: (projectId: string, fileId: string, v1?: string, v2?: string) => {
      const params = new URLSearchParams();
      if (v1) params.set('v1', v1);
      if (v2) params.set('v2', v2);
      return request<{
        v1: { label: string; versionNumber?: number; createdAt?: string };
        v2: { label: string; versionNumber?: number; createdAt?: string };
        diff: {
          addedCount: number;
          removedCount: number;
          unchangedCount: number;
          lines: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string; oldLineNumber?: number; newLineNumber?: number }>;
        };
        originalContent: string;
        modifiedContent: string;
      }>(`/projects/${projectId}/files/${fileId}/diff?${params.toString()}`);
    },

    createSnapshot: (projectId: string, fileId: string, summary?: string, content?: string) =>
      request<{ version: IFileVersion }>(`/projects/${projectId}/files/${fileId}/history/snapshot`, {
        method: 'POST',
        body: JSON.stringify({ summary, content }),
      }),

    restore: (projectId: string, fileId: string, versionId: string) =>
      request<{ message: string; file: IFileNode; newVersion: IFileVersion }>(
        `/projects/${projectId}/files/${fileId}/restore/${versionId}`,
        { method: 'POST' }
      ),
  },

  // Collaboration
  collaboration: {
    createInvitation: (projectId: string, role: 'editor' | 'viewer' = 'editor') =>
      request<{ invitation: { token: string; expiresAt: string } }>(`/projects/${projectId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),

    joinByToken: (token: string) =>
      request<{ project: IProject; projectId: string }>('/projects/join', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),

    getMembers: (projectId: string) =>
      request<{ members: any[] }>(`/projects/${projectId}/members`),

    updateRole: (projectId: string, userId: string, role: string) =>
      request<{ member: any }>(`/projects/${projectId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),

    removeMember: (projectId: string, userId: string) =>
      request<{ message: string }>(`/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      }),
  },

  // Git
  git: {
    getStatus: (projectId: string) => request<IGitStatus>(`/projects/${projectId}/git/status`),

    initRepo: (projectId: string) => request<{ message: string }>(`/projects/${projectId}/git/init`, { method: 'POST' }),

    stageFile: (projectId: string, filePath: string) =>
      request<{ message: string }>(`/projects/${projectId}/git/stage`, {
        method: 'POST',
        body: JSON.stringify({ filePath }),
      }),

    unstageFile: (projectId: string, filePath: string) =>
      request<{ message: string }>(`/projects/${projectId}/git/unstage`, {
        method: 'POST',
        body: JSON.stringify({ filePath }),
      }),

    commit: (projectId: string, message: string) =>
      request<{ message: string; output: string }>(`/projects/${projectId}/git/commit`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),

    getDiff: (projectId: string, file?: string, staged: boolean = false) => {
      const params = new URLSearchParams();
      if (file) params.set('file', file);
      if (staged) params.set('staged', 'true');
      const q = params.toString() ? `?${params.toString()}` : '';
      return request<{ diff: string }>(`/projects/${projectId}/git/diff${q}`);
    },

    getHistory: (projectId: string) => request<{ commits: IGitCommit[] }>(`/projects/${projectId}/git/history`),

    createBranch: (projectId: string, branchName: string) =>
      request<{ message: string }>(`/projects/${projectId}/git/branch`, {
        method: 'POST',
        body: JSON.stringify({ branchName }),
      }),
  },

  // Execution
  execution: {
    runFile: (projectId: string, fileId: string, content?: string) =>
      request<{ stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean }>(
        `/projects/${projectId}/run/${fileId}`,
        {
          method: 'POST',
          body: content !== undefined ? JSON.stringify({ content }) : undefined,
        }
      ),

    stopAll: (projectId: string) =>
      request<{ message: string }>(`/projects/${projectId}/stop`, { method: 'POST' }),

    runEntryFile: (projectId: string, content?: string) =>
      request<{ stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean; command?: string }>(
        `/projects/${projectId}/run-entry`,
        {
          method: 'POST',
          body: content !== undefined ? JSON.stringify({ content }) : undefined,
        }
      ),

    getRunConfig: (projectId: string) =>
      request<{
        projectId: string;
        projectName: string;
        template: string;
        entryFile: string;
        entryFileId: string | null;
        runnerInfo: {
          language: string;
          runner: string;
          command: string;
          toolRequired: string;
          isToolInstalled: boolean;
          folderConventions: string;
        };
        toolchains: Record<string, { installed: boolean; version?: string }>;
      }>(`/projects/${projectId}/run-config`),
  },

  // Workspace-scoped Activities
  activities: {
    getWorkspaceActivities: (
      projectId: string,
      params: { eventType?: string; page?: number; limit?: number } = {}
    ) => {
      const q = new URLSearchParams();
      if (params.eventType) q.set('eventType', params.eventType);
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request<{
        activities: IActivityRecord[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/projects/${projectId}/activities${qs}`);
    },
  },

  // Admin Platform Operations (Admin Role Only)
  admin: {
    getOverview: () => request<{ overview: IAdminOverview }>('/admin/overview'),

    getUsers: (params: { search?: string; role?: string; status?: string; page?: number; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.role) q.set('role', params.role);
      if (params.status) q.set('status', params.status);
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request<{
        users: IAdminUser[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/admin/users${qs}`);
    },

    updateUserRole: (userId: string, role: 'admin' | 'user') =>
      request<{ user: IUser; message: string }>(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),

    updateUserStatus: (userId: string, status: 'active' | 'suspended') =>
      request<{ user: IUser; message: string }>(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    getSessions: () =>
      request<{
        activeSessionsCount: number;
        activeUsersCount: number;
        activeWorkspacesCount: number;
        workspaces: ILiveSessionWorkspace[];
      }>('/admin/sessions'),

    getWorkspaces: (params: { search?: string; visibility?: string; template?: string; page?: number; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.visibility) q.set('visibility', params.visibility);
      if (params.template) q.set('template', params.template);
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request<{
        workspaces: IAdminWorkspace[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/admin/workspaces${qs}`);
    },

    getActivities: (params: {
      search?: string;
      eventType?: string;
      workspaceId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}) => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.eventType) q.set('eventType', params.eventType);
      if (params.workspaceId) q.set('workspaceId', params.workspaceId);
      if (params.userId) q.set('userId', params.userId);
      if (params.startDate) q.set('startDate', params.startDate);
      if (params.endDate) q.set('endDate', params.endDate);
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request<{
        activities: IActivityRecord[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/admin/activities${qs}`);
    },

    getPerformance: () => request<IPerformanceData>('/admin/performance'),

    getAuditLogs: (params: {
      search?: string;
      actorId?: string;
      action?: string;
      targetType?: string;
      page?: number;
      limit?: number;
    } = {}) => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.actorId) q.set('actorId', params.actorId);
      if (params.action) q.set('action', params.action);
      if (params.targetType) q.set('targetType', params.targetType);
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request<{
        auditLogs: IAuditRecord[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/admin/audit-logs${qs}`);
    },
  },
};
