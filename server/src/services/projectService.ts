import { TEMPLATE_DEFINITIONS, resolveTemplateKey, getDefaultEntryFile } from './templates.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { config } from '../config/index.js';
import { ProjectRepository, IProject } from '../models/Project.js';
import { FileNodeRepository, IFileNode } from '../models/FileNode.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';

export class ProjectService {
  static getProjectPath(projectId: string): string {
    return path.join(config.storageDir, projectId);
  }

  static async createProject(userId: string, name: string, description: string = '', template: string = 'vanilla', isPublic: boolean = false): Promise<IProject> {
    const projectId = uuidv4();
    const projectDir = this.getProjectPath(projectId);

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const project: IProject = {
      id: projectId,
      name,
      description,
      ownerId: userId,
      template,
      isPublic,
      rootPath: projectDir,
      entryFile: this.getDefaultEntryFile(template),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdProject = await ProjectRepository.create(project);

    // Add owner membership
    await ProjectMemberRepository.addMember({
      id: uuidv4(),
      projectId,
      userId,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    });

    // Populate template files
    await this.applyTemplate(projectId, template, projectDir);

    return createdProject;
  }

  static getDefaultEntryFile(template: string): string {
    return getDefaultEntryFile(template);
  }

  static async applyTemplate(projectId: string, template: string, projectDir: string): Promise<void> {
    const key = resolveTemplateKey(template);
    const def = TEMPLATE_DEFINITIONS[key] || TEMPLATE_DEFINITIONS.vanilla;
    const chosenTemplate = def.files;

    for (const [relPath, content] of Object.entries(chosenTemplate)) {
      const fullPath = path.join(projectDir, relPath);
      const dirName = path.dirname(fullPath);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');

      const parts = relPath.split(/[/\\]/);
      let currentPath = '';
      let parentId: string | null = null;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = i === parts.length - 1;

        let existing = await FileNodeRepository.findByPath(projectId, currentPath);
        if (!existing) {
          const node: IFileNode = {
            id: uuidv4(),
            projectId,
            parentId,
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            content: isFile ? content : undefined,
            language: isFile ? this.detectLanguage(part) : undefined,
            size: isFile ? Buffer.byteLength(content, 'utf-8') : 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          existing = await FileNodeRepository.create(node);
        }
        parentId = existing.id;
      }
    }
  }

  static detectLanguage(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const map: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.md': 'markdown',
      '.py': 'python',
      '.cpp': 'cpp',
      '.c++': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'cpp',
      '.hpp': 'cpp',
      '.java': 'java',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bat': 'bat',
      '.ps1': 'powershell',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.toml': 'toml',
      '.mk': 'makefile',
      '.txt': 'plaintext',
    };
    return map[ext] || 'plaintext';
  }

  static async exportProjectZip(projectId: string, res: any): Promise<void> {
    const projectDir = this.getProjectPath(projectId);
    if (!fs.existsSync(projectDir)) {
      throw new Error('Project storage directory not found');
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(projectDir, false);
    await archive.finalize();
  }

  static async importProjectZip(userId: string, projectName: string, zipFilePath: string): Promise<IProject> {
    const project = await this.createProject(userId, projectName, 'Imported project', 'custom');
    const projectDir = this.getProjectPath(project.id);

    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    // Prevent Zip Slip / path traversal attacks
    for (const entry of zipEntries) {
      const normalized = path.normalize(entry.entryName);
      if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
        throw new Error('Invalid zip entry: Path traversal detected');
      }
    }

    zip.extractAllTo(projectDir, true);

    // Re-index all extracted files into FileNodeRepository
    await this.scanAndIndexDirectory(project.id, projectDir, projectDir, null);

    return project;
  }

  private static async scanAndIndexDirectory(projectId: string, rootDir: string, currentDir: string, parentId: string | null): Promise<void> {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      const isFile = entry.isFile();

      let content = '';
      if (isFile) {
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
          content = '';
        }
      }

      let node = await FileNodeRepository.findByPath(projectId, relPath);
      if (!node) {
        node = await FileNodeRepository.create({
          id: uuidv4(),
          projectId,
          parentId,
          name: entry.name,
          path: relPath,
          type: isFile ? 'file' : 'directory',
          content: isFile ? content : undefined,
          language: isFile ? this.detectLanguage(entry.name) : undefined,
          size: isFile ? Buffer.byteLength(content, 'utf-8') : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (entry.isDirectory()) {
        await this.scanAndIndexDirectory(projectId, rootDir, fullPath, node.id);
      }
    }
  }
}
