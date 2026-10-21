import { Router } from 'express';
import { ProjectController } from '../controllers/projectController.js';
import { authMiddleware, requireProjectRole } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', ProjectController.getProjects);
router.post('/', ProjectController.createProject);
router.get('/:projectId', requireProjectRole('viewer'), ProjectController.getProject);
router.put('/:projectId', requireProjectRole('owner'), ProjectController.updateProject);
router.delete('/:projectId', requireProjectRole('owner'), ProjectController.deleteProject);
router.get('/:projectId/export', requireProjectRole('viewer'), ProjectController.exportProject);

export default router;
