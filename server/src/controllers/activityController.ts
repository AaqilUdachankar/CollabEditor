import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ActivityRepository } from '../models/Activity.js';
import { ProjectRepository } from '../models/Project.js';

export class ActivityController {
  static async getWorkspaceActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const eventType = (req.query.eventType as string || '').trim() || undefined;
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
      const skip = (page - 1) * limit;

      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Workspace not found' });
        return;
      }

      // Fetch workspace-scoped activities strictly matching this projectId
      const result = await ActivityRepository.findByProject(projectId, {
        eventType,
        limit,
        skip,
      });

      res.json({
        activities: result.activities,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (err: any) {
      console.error('[Workspace Activities Error]', err);
      res.status(500).json({ error: 'Failed to retrieve workspace activities' });
    }
  }
}

