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

export interface GitStatusResult {
  isRepo: boolean;
  gitAvailable: boolean;
  branch: string;
  files: GitFileStatus[];
  error?: string;
}

export class GitService {
  /**
   * Check whether git binary is installed and executable in system PATH
   */
  static async checkGitAvailable(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const { stdout } = await execFileAsync('git', ['--version']);
      return { available: true, version: stdout.trim() };
    } catch (err: any) {
      return {
        available: false,
        error: 'Git binary is not installed or not available in the system PATH',
      };
    }
  }

  /**
   * Validate that file path does not attempt path traversal outside workspace root
   */
  private static validateSafePath(projectId: string, relativePath: string): string {
    if (!relativePath || typeof relativePath !== 'string') {
      throw new Error('Invalid file path');
    }

    if (relativePath === '.') {
      return '.';
    }

    if (relativePath.includes('..')) {
      throw new Error('Path traversal is not permitted');
    }

    const projectDir = path.resolve(ProjectService.getProjectPath(projectId));
    const resolvedPath = path.resolve(projectDir, relativePath);

    if (!resolvedPath.startsWith(projectDir)) {
      throw new Error('Access outside project repository root is not permitted');
    }

    return relativePath;
  }

  /**
   * Detect sensitive environment and secret files that must never be committed by default
   */
  static isSecretFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const fileName = path.basename(normalized);
    return (
      fileName === '.env' ||
      fileName.startsWith('.env.') ||
      fileName.endsWith('.pem') ||
      fileName.endsWith('.key') ||
      fileName.includes('id_rsa') ||
      fileName.includes('credentials.json')
    );
  }

  /**
   * Safe Git process wrapper using argument arrays (prevents shell injection)
   */
  private static async runGit(projectId: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    const projectDir = path.resolve(ProjectService.getProjectPath(projectId));
    if (!fs.existsSync(projectDir)) {
      throw new Error('Project directory does not exist');
    }

    const gitCheck = await this.checkGitAvailable();
    if (!gitCheck.available) {
      throw new Error(gitCheck.error || 'Git binary is not available');
    }

    try {
      return await execFileAsync('git', args, {
        cwd: projectDir,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          LC_ALL: 'C',
        },
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
    const projectDir = ProjectService.getProjectPath(projectId);
    await this.runGit(projectId, ['init']);

    // Ensure default .gitignore protects secrets
    const gitignorePath = path.join(projectDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(
        gitignorePath,
        `# Environment and secrets\n.env\n.env.*\n*.pem\n*.key\nid_rsa\n\n# Dependencies\nnode_modules/\n`,
        'utf-8'
      );
    }

    try {
      await this.runGit(projectId, ['config', 'user.name', 'CollabIDE User']);
      await this.runGit(projectId, ['config', 'user.email', 'developer@collabide.local']);
    } catch {
      // Configuration fallback
    }
  }

  static async getBranch(projectId: string): Promise<string> {
    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) return '';

    try {
      const { stdout } = await this.runGit(projectId, ['rev-parse', '--abbrev-ref', 'HEAD']);
      return stdout.trim() || 'main';
    } catch {
      return 'main';
    }
  }

  static async getStatus(projectId: string): Promise<GitStatusResult> {
    const gitCheck = await this.checkGitAvailable();
    if (!gitCheck.available) {
      return {
        isRepo: false,
        gitAvailable: false,
        branch: '',
        files: [],
        error: gitCheck.error,
      };
    }

    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) {
      return {
        isRepo: false,
        gitAvailable: true,
        branch: 'uninitialized',
        files: [],
      };
    }

    try {
      const branch = await this.getBranch(projectId);
      const { stdout } = await this.runGit(projectId, ['status', '--porcelain=v1']);
      const files: GitFileStatus[] = [];

      const lines = stdout.split('\n').filter(Boolean);
      for (const line of lines) {
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const filePath = line.substring(3).trim();

        // Never show or commit .env or secrets by default
        if (this.isSecretFile(filePath)) {
          continue;
        }

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

      return {
        isRepo: true,
        gitAvailable: true,
        branch: branch || 'main',
        files,
      };
    } catch (err: any) {
      return {
        isRepo: true,
        gitAvailable: true,
        branch: 'error',
        files: [],
        error: err.message,
      };
    }
  }

  static async stageFile(projectId: string, filePath: string): Promise<void> {
    const safePath = this.validateSafePath(projectId, filePath);

    if (safePath !== '.' && this.isSecretFile(safePath)) {
      throw new Error(`Cannot stage sensitive secret file: ${safePath}`);
    }

    await this.runGit(projectId, ['add', safePath]);
  }

  static async unstageFile(projectId: string, filePath: string): Promise<void> {
    const safePath = this.validateSafePath(projectId, filePath);
    await this.runGit(projectId, ['reset', 'HEAD', safePath]);
  }

  static async commit(projectId: string, message: string, authorName?: string, authorEmail?: string): Promise<string> {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Commit message cannot be empty');
    }

    const name = authorName ? authorName.trim() : 'CollabIDE User';
    const email = authorEmail ? authorEmail.trim() : `${name.toLowerCase()}@collabide.local`;
    const authorArg = `--author=${name} <${email}>`;

    // Safe argument array prevents shell command interpolation
    const { stdout } = await this.runGit(projectId, ['commit', '-m', message.trim(), authorArg]);
    return stdout.trim();
  }

  static async getDiff(projectId: string, filePath?: string, staged: boolean = false): Promise<string> {
    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) return '';

    const args = ['diff'];
    if (staged) {
      args.push('--cached');
    }

    if (filePath) {
      const safePath = this.validateSafePath(projectId, filePath);
      args.push(safePath);
    }

    const { stdout } = await this.runGit(projectId, args);
    return stdout;
  }

  static async getHistory(projectId: string, limit: number = 20): Promise<GitCommitInfo[]> {
    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) return [];

    try {
      const { stdout } = await this.runGit(projectId, [
        'log',
        `-${Math.min(limit, 100)}`,
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
    if (!branchName || typeof branchName !== 'string' || !branchName.trim()) {
      throw new Error('Branch name cannot be empty');
    }

    // Sanitize branch name (no special shell characters or whitespace)
    const sanitized = branchName.trim().replace(/[^a-zA-Z0-9_\-\./]/g, '');
    if (!sanitized) {
      throw new Error('Invalid branch name');
    }

    await this.runGit(projectId, ['checkout', '-b', sanitized]);
  }
}
