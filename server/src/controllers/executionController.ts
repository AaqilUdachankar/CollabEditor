import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ExecutionService } from '../services/executionService.js';

export class ExecutionController {
  static async runFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const fileId = String(req.params.fileId);
      const result = await ExecutionService.runFile(projectId, fileId);
      res.json(result);
    } catch (err: any) {
      console.error('[Run File Error]', err);
      res.status(400).json({ error: err.message || 'Execution failed' });
    }
  }

  static async stopAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      ExecutionService.killAllForProject(projectId);
      res.json({ message: 'All project execution processes terminated' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to stop processes' });
    }
  }
}
