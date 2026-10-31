export interface IUser {
  id: string;
  email: string;
  username: string;
  avatarColor: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'suspended';
  lastActive?: string;
}

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface IProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  template: string;
  isPublic: boolean;
  rootPath?: string;
  role?: ProjectRole;
  createdAt: string;
  updatedAt: string;
}

export interface IFileNode {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
  language?: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ITab {
  id: string;
  fileId: string;
  title: string;
  path: string;
  language: string;
  isDirty?: boolean;
}

export interface IEditorGroup {
  id: string;
  tabs: ITab[];
  activeTabId: string | null;
}

export interface ICollaboratorPresence {
  socketId: string;
  userId: string;
  username: string;
  avatarColor: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'suspended';
  lastActive?: string;
  activeFileId: string | null;
  activeFilePath: string | null;
  cursorLine: number;
  cursorCol: number;
}

export interface IGitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'copied';
  staged: boolean;
}

export interface IGitStatus {
  isRepo?: boolean;
  gitAvailable?: boolean;
  branch: string;
  files: IGitFile[];
  error?: string;
}

export interface IGitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export type ActivityView = 'explorer' | 'search' | 'git' | 'debug' | 'extensions' | 'collab' | 'admin';
export type PanelTab = 'terminal' | 'output' | 'problems' | 'debug';

export interface ISettings {
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
}

export interface IFileVersion {
  id: string;
  projectId: string;
  fileId: string;
  versionNumber: number;
  content: string;
  size: number;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  summary?: string;
  createdAt: string;
}

export interface ISearchResult {
  fileId: string;
  filePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
  colStart?: number;
  colEnd?: number;
  matchType?: 'content' | 'filename';
}

export interface IActivityRecord {
  id: string;
  projectId?: string;
  userId: string;
  username: string;
  userEmail?: string;
  eventType: string;
  action: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface IAuditRecord {
  id: string;
  actorId: string;
  actorUsername: string;
  actorEmail?: string;
  action: string;
  targetType: 'user' | 'project' | 'member' | 'system';
  targetId: string;
  targetName?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface IAdminOverview {
  registeredUsers: number;
  activeUsers: number;
  activeSessions: number;
  activeWorkspaces: number;
  totalWorkspaces: number;
  recentActivities: IActivityRecord[];
  healthCounts: {
    totalErrors: number;
    executionErrors: number;
    saveFailures: number;
    apiErrors: number;
    websocketErrors: number;
    timeoutCount: number;
    systemStatus: 'healthy' | 'degraded';
  };
}

export interface IAdminUser {
  id: string;
  username: string;
  email: string;
  avatarColor: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  lastActive: string;
  createdAt: string;
  workspaceCount: number;
  workspaces: Array<{ id: string; name: string; role: string }>;
}

export interface ILiveSessionWorkspace {
  workspaceId: string;
  workspaceName: string;
  ownerId: string;
  participantsCount: number;
  participants: Array<{
    socketId: string;
    userId: string;
    username: string;
    avatarColor: string;
    connectionState: string;
    connectedAt: string;
    durationSeconds: number;
    activeFile: {
      fileId: string | null;
      path: string | null;
      line: number;
      col: number;
    } | null;
  }>;
}

export interface IAdminWorkspace {
  id: string;
  name: string;
  description: string;
  owner: { id: string; username: string; email: string };
  template: string;
  isPublic: boolean;
  membersCount: number;
  members: Array<{ userId: string; username: string; role: string }>;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
}

export interface IPerformanceData {
  executions: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgDurationMs: number;
    timeoutCount: number;
  };
  errors: {
    saveFailures: number;
    apiErrors: number;
    websocketErrors: number;
    reconnects: number;
    totalErrors: number;
  };
  system: {
    uptimeSeconds: number;
    memoryUsageMb: number;
    nodeVersion: string;
    platform: string;
    status: 'healthy' | 'degraded';
  };
}

