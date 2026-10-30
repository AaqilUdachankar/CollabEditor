export interface IUser {
  id: string;
  email: string;
  username: string;
  avatarColor: string;
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
  branch: string;
  files: IGitFile[];
}

export interface IGitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export type ActivityView = 'explorer' | 'search' | 'git' | 'debug' | 'extensions' | 'collab';
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
