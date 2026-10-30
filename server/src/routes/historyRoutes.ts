import { Router } from 'express';
import { HistoryController } from '../controllers/historyController.js';
import { authMiddleware, requireProjectRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// Workspace membership validated on every history API endpoint
router.get('/:projectId/files/:fileId/history', requireProjectRole('viewer'), HistoryController.getHistory);
router.get('/:projectId/files/:fileId/history/:versionId', requireProjectRole('viewer'), HistoryController.getVersion);
router.get('/:projectId/files/:fileId/diff', requireProjectRole('viewer'), HistoryController.getDiff);
router.post('/:projectId/files/:fileId/history/snapshot', requireProjectRole('editor'), HistoryController.createSnapshot);
router.post('/:projectId/files/:fileId/restore/:versionId', requireProjectRole('editor'), HistoryController.restoreVersion);

export default router;
