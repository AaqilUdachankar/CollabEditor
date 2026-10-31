import { Router } from 'express';
import { authMiddleware, requireProjectRole } from '../middleware/auth.js';
import { ActivityController } from '../controllers/activityController.js';

const router = Router();

// Workspace-scoped activities: Requires authentication and membership in the project
router.get(
  '/:projectId/activities',
  authMiddleware,
  requireProjectRole('viewer'),
  ActivityController.getWorkspaceActivities
);

export default router;

