import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { GitService } from '../services/gitService.js';

export class GitController {
  static async getStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const status = await GitService.getStatus(projectId);
      res.json(status);
    } catch (err: any) {
      console.error('[Git Status Error]', err);
      res.status(500).json({ error: err.message || 'Failed to get git status' });
    }
  }

  static async checkAvailable(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await GitService.checkGitAvailable();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ available: false, error: err.message });
    }
  }

  static async initRepo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      await GitService.initRepo(projectId);
      res.json({ message: 'Git repository initialized successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to initialize git repository' });
    }
  }

  static async stageFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ error: 'File path is required' });
        return;
      }
      await GitService.stageFile(projectId, filePath);
      res.json({ message: `Staged ${filePath}` });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to stage file' });
    }
  }

  static async unstageFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ error: 'File path is required' });
        return;
      }
      await GitService.unstageFile(projectId, filePath);
      res.json({ message: `Unstaged ${filePath}` });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to unstage file' });
    }
  }

  static async commit(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { message } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Commit message is required' });
        return;
      }

      const output = await GitService.commit(
        projectId,
        message.trim(),
        req.user?.username,
        req.user?.email
      );
      res.json({ message: 'Commit successful', output });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to commit changes' });
    }
  }

  static async getDiff(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { file, staged } = req.query;
      const diff = await GitService.getDiff(
        projectId,
        typeof file === 'string' ? file : undefined,
        staged === 'true'
      );
      res.json({ diff });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get git diff' });
    }
  }

  static async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const commits = await GitService.getHistory(projectId);
      res.json({ commits });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get commit history' });
    }
  }

  static async createBranch(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { branchName } = req.body;
      if (!branchName) {
        res.status(400).json({ error: 'Branch name is required' });
        return;
      }
      await GitService.createBranch(projectId, branchName);
      res.json({ message: `Switched to branch ${branchName}` });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create branch' });
    }
  }
}
