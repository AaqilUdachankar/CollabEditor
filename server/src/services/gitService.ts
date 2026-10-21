import { execFile } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import { ProjectService } from './projectService.js';

const execFileAsync = util.promisify(execFile);

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'copied';
  staged: boolean;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export class GitService {
  private static async runGit(projectId: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    const projectDir = ProjectService.getProjectPath(projectId);
    if (!fs.existsSync(projectDir)) {
      throw new Error('Project directory does not exist');
    }

    try {
      return await execFileAsync('git', args, {
        cwd: projectDir,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err: any) {
      const msg = err.stderr || err.stdout || err.message;
      throw new Error(`Git error: ${msg}`);
    }
  }

  static async isGitRepo(projectId: string): Promise<boolean> {
    const projectDir = ProjectService.getProjectPath(projectId);
    return fs.existsSync(path.join(projectDir, '.git'));
  }

  static async initRepo(projectId: string): Promise<void> {
    await this.runGit(projectId, ['init']);
    try {
      await this.runGit(projectId, ['config', 'user.name', 'CollabIDE User']);
      await this.runGit(projectId, ['config', 'user.email', 'developer@collabide.local']);
    } catch {
      // Configuration fallback
    }
  }

  static async getBranch(projectId: string): Promise<string> {
    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) return 'main';

    try {
      const { stdout } = await this.runGit(projectId, ['rev-parse', '--abbrev-ref', 'HEAD']);
      return stdout.trim() || 'main';
    } catch {
      return 'main';
    }
  }

  static async getStatus(projectId: string): Promise<{ branch: string; files: GitFileStatus[] }> {
    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) {
      return { branch: 'uninitialized', files: [] };
    }

    const branch = await this.getBranch(projectId);
    const { stdout } = await this.runGit(projectId, ['status', '--porcelain=v1']);
    const files: GitFileStatus[] = [];

    const lines = stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.substring(3).trim();

      if (indexStatus !== ' ' && indexStatus !== '?') {
        files.push({
          path: filePath,
          status: indexStatus === 'A' ? 'added' : indexStatus === 'D' ? 'deleted' : 'modified',
          staged: true,
        });
      }

      if (workTreeStatus === '?') {
        files.push({
          path: filePath,
          status: 'untracked',
          staged: false,
        });
      } else if (workTreeStatus !== ' ') {
        files.push({
          path: filePath,
          status: workTreeStatus === 'D' ? 'deleted' : 'modified',
          staged: false,
        });
      }
    }

    return { branch, files };
  }

  static async stageFile(projectId: string, filePath: string): Promise<void> {
    await this.runGit(projectId, ['add', filePath]);
  }

  static async unstageFile(projectId: string, filePath: string): Promise<void> {
    await this.runGit(projectId, ['reset', 'HEAD', filePath]);
  }

  static async commit(projectId: string, message: string, authorName?: string): Promise<string> {
    if (!message || !message.trim()) {
      throw new Error('Commit message cannot be empty');
    }

    const author = authorName ? `${authorName} <${authorName.toLowerCase()}@collabide.local>` : 'CollabIDE User <dev@collabide.local>';
    const { stdout } = await this.runGit(projectId, ['commit', '-m', message.trim(), `--author=${author}`]);
    return stdout.trim();
  }

  static async getDiff(projectId: string, filePath?: string): Promise<string> {
    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) return '';

    const args = ['diff'];
    if (filePath) args.push(filePath);
    const { stdout } = await this.runGit(projectId, args);
    return stdout;
  }

  static async getHistory(projectId: string, limit: number = 20): Promise<GitCommitInfo[]> {
    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) return [];

    try {
      const { stdout } = await this.runGit(projectId, [
        'log',
        `-${limit}`,
        '--pretty=format:%H%x09%h%x09%an%x09%ad%x09%s',
        '--date=short',
      ]);

      const commits: GitCommitInfo[] = [];
      const lines = stdout.split('\n').filter(Boolean);
      for (const line of lines) {
        const [hash, shortHash, author, date, message] = line.split('\t');
        if (hash) {
          commits.push({ hash, shortHash, author, date, message });
        }
      }
      return commits;
    } catch {
      return [];
    }
  }

  static async createBranch(projectId: string, branchName: string): Promise<void> {
    await this.runGit(projectId, ['checkout', '-b', branchName.trim()]);
  }
}
