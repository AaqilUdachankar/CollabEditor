import { Router } from 'express';
import { ExecutionController } from '../controllers/executionController.js';
import { authMiddleware, requireProjectRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/:projectId/run-config', requireProjectRole('viewer'), ExecutionController.getRunConfig);
router.post('/:projectId/run-entry', requireProjectRole('editor'), ExecutionController.runEntryFile);
router.post('/:projectId/run/:fileId', requireProjectRole('editor'), ExecutionController.runFile);
router.post('/:projectId/stop', requireProjectRole('editor'), ExecutionController.stopAll);

export default router;
