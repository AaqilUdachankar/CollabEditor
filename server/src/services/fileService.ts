import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProjectService } from './projectService.js';
import { FileNodeRepository, IFileNode } from '../models/FileNode.js';

export interface SearchResult {
  fileId: string;
  filePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export class FileService {
  static sanitizeName(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '').trim();
  }

  static async getProjectTree(projectId: string): Promise<IFileNode[]> {
    return FileNodeRepository.findByProject(projectId);
  }

  static async createFile(projectId: string, parentId: string | null, name: string, content: string = ''): Promise<IFileNode> {
    const cleanName = this.sanitizeName(name);
    if (!cleanName) throw new Error('Invalid file name');

    let relPath = cleanName;
    if (parentId) {
      const parent = await FileNodeRepository.findById(parentId);
      if (!parent || parent.type !== 'directory') throw new Error('Parent directory not found');
      relPath = `${parent.path}/${cleanName}`;
    }

    const existing = await FileNodeRepository.findByPath(projectId, relPath);
    if (existing) throw new Error(`A file or folder with path "${relPath}" already exists`);

    const fullDiskPath = path.join(ProjectService.getProjectPath(projectId), relPath);
    const dirName = path.dirname(fullDiskPath);
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }
    fs.writeFileSync(fullDiskPath, content, 'utf-8');

    const node: IFileNode = {
      id: uuidv4(),
      projectId,
      parentId,
      name: cleanName,
      path: relPath,
      type: 'file',
      content,
      language: ProjectService.detectLanguage(cleanName),
      size: Buffer.byteLength(content, 'utf-8'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return FileNodeRepository.create(node);
  }

  static async createDirectory(projectId: string, parentId: string | null, name: string): Promise<IFileNode> {
    const cleanName = this.sanitizeName(name);
    if (!cleanName) throw new Error('Invalid folder name');

    let relPath = cleanName;
    if (parentId) {
      const parent = await FileNodeRepository.findById(parentId);
      if (!parent || parent.type !== 'directory') throw new Error('Parent directory not found');
      relPath = `${parent.path}/${cleanName}`;
    }

    const existing = await FileNodeRepository.findByPath(projectId, relPath);
    if (existing) throw new Error(`A file or folder with path "${relPath}" already exists`);

    const fullDiskPath = path.join(ProjectService.getProjectPath(projectId), relPath);
    if (!fs.existsSync(fullDiskPath)) {
      fs.mkdirSync(fullDiskPath, { recursive: true });
    }

    const node: IFileNode = {
      id: uuidv4(),
      projectId,
      parentId,
      name: cleanName,
      path: relPath,
      type: 'directory',
      size: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return FileNodeRepository.create(node);
  }

  static async saveFileContent(projectId: string, fileId: string, content: string): Promise<IFileNode> {
    const file = await FileNodeRepository.findById(fileId);
    if (!file || file.projectId !== projectId) throw new Error('File not found');
    if (file.type !== 'file') throw new Error('Cannot write content to a directory');

    const fullDiskPath = path.join(ProjectService.getProjectPath(projectId), file.path);
    const dir = path.dirname(fullDiskPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullDiskPath, content, 'utf-8');

    const updated = await FileNodeRepository.update(fileId, {
      content,
      size: Buffer.byteLength(content, 'utf-8'),
      updatedAt: new Date().toISOString(),
    });

    return updated!;
  }

  static async renameNode(projectId: string, nodeId: string, newName: string): Promise<IFileNode> {
    const cleanName = this.sanitizeName(newName);
    if (!cleanName) throw new Error('Invalid name');

    const node = await FileNodeRepository.findById(nodeId);
    if (!node || node.projectId !== projectId) throw new Error('Node not found');
    if (node.name === cleanName) return node;

    const oldRelPath = node.path;
    const parentRelPath = path.dirname(oldRelPath);
    const newRelPath = parentRelPath === '.' ? cleanName : `${parentRelPath}/${cleanName}`;

    const projectRoot = ProjectService.getProjectPath(projectId);
    const oldDiskPath = path.join(projectRoot, oldRelPath);
    const newDiskPath = path.join(projectRoot, newRelPath);

    if (fs.existsSync(newDiskPath)) {
      throw new Error(`Target path already exists: ${newRelPath}`);
    }

    if (fs.existsSync(oldDiskPath)) {
      fs.renameSync(oldDiskPath, newDiskPath);
    }

    // Update the node itself
    const updated = await FileNodeRepository.update(nodeId, {
      name: cleanName,
      path: newRelPath,
      language: node.type === 'file' ? ProjectService.detectLanguage(cleanName) : undefined,
      updatedAt: new Date().toISOString(),
    });

    // If it's a directory, recursively update all child paths in DB
    if (node.type === 'directory') {
      const allFiles = await FileNodeRepository.findByProject(projectId);
      for (const item of allFiles) {
        if (item.path.startsWith(`${oldRelPath}/`)) {
          const suffix = item.path.substring(oldRelPath.length);
          const childNewRelPath = `${newRelPath}${suffix}`;
          await FileNodeRepository.update(item.id, {
            path: childNewRelPath,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return updated!;
  }

  static async deleteNode(projectId: string, nodeId: string): Promise<boolean> {
    const node = await FileNodeRepository.findById(nodeId);
    if (!node || node.projectId !== projectId) throw new Error('Node not found');

    const projectRoot = ProjectService.getProjectPath(projectId);
    const diskPath = path.join(projectRoot, node.path);

    if (fs.existsSync(diskPath)) {
      if (node.type === 'directory') {
        fs.rmSync(diskPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(diskPath);
      }
    }

    // If directory, delete all descendants in DB
    if (node.type === 'directory') {
      const allFiles = await FileNodeRepository.findByProject(projectId);
      for (const item of allFiles) {
        if (item.path === node.path || item.path.startsWith(`${node.path}/`)) {
          await FileNodeRepository.delete(item.id);
        }
      }
    } else {
      await FileNodeRepository.delete(nodeId);
    }

    return true;
  }

  static async duplicateNode(projectId: string, nodeId: string): Promise<IFileNode> {
    const node = await FileNodeRepository.findById(nodeId);
    if (!node || node.projectId !== projectId) throw new Error('Node not found');
    if (node.type !== 'file') throw new Error('Only files can be duplicated currently');

    const ext = path.extname(node.name);
    const base = path.basename(node.name, ext);
    let copyName = `${base} copy${ext}`;
    let counter = 2;

    while (await FileNodeRepository.findByPath(projectId, node.parentId ? `${path.dirname(node.path)}/${copyName}` : copyName)) {
      copyName = `${base} copy ${counter}${ext}`;
      counter++;
    }

    return this.createFile(projectId, node.parentId, copyName, node.content || '');
  }

  static async searchAcrossFiles(
    projectId: string,
    query: string,
    options: { matchCase?: boolean; wholeWord?: boolean; isRegex?: boolean } = {}
  ): Promise<SearchResult[]> {
    if (!query) return [];

    const files = await FileNodeRepository.findByProject(projectId);
    const results: SearchResult[] = [];

    let regex: RegExp;
    try {
      let pattern = options.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (options.wholeWord) pattern = `\\b${pattern}\\b`;
      regex = new RegExp(pattern, options.matchCase ? 'g' : 'gi');
    } catch {
      return [];
    }

    for (const file of files) {
      if (file.type !== 'file' || !file.content) continue;

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;

        while ((match = regex.exec(line)) !== null) {
          results.push({
            fileId: file.id,
            filePath: file.path,
            fileName: file.name,
            lineNumber: i + 1,
            lineContent: line.trim(),
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });

          // Prevent zero-length regex infinite loops
          if (match.index === regex.lastIndex) regex.lastIndex++;
        }
      }
    }

    return results;
  }
}
