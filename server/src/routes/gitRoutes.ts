import { Router } from 'express';
import { GitController } from '../controllers/gitController.js';
import { authMiddleware, requireProjectRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/:projectId/git/status', requireProjectRole('viewer'), GitController.getStatus);
router.post('/:projectId/git/init', requireProjectRole('editor'), GitController.initRepo);
router.post('/:projectId/git/stage', requireProjectRole('editor'), GitController.stageFile);
router.post('/:projectId/git/unstage', requireProjectRole('editor'), GitController.unstageFile);
router.post('/:projectId/git/commit', requireProjectRole('editor'), GitController.commit);
router.get('/:projectId/git/diff', requireProjectRole('viewer'), GitController.getDiff);
router.get('/:projectId/git/history', requireProjectRole('viewer'), GitController.getHistory);
router.post('/:projectId/git/branch', requireProjectRole('editor'), GitController.createBranch);

export default router;
