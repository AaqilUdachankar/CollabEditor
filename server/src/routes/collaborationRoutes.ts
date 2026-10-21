import { Router } from 'express';
import { CollaborationController } from '../controllers/collaborationController.js';
import { authMiddleware, requireProjectRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.post('/:projectId/invitations', requireProjectRole('editor'), CollaborationController.createInvitation);
router.post('/join', CollaborationController.joinByToken);
router.get('/:projectId/members', requireProjectRole('viewer'), CollaborationController.getMembers);
router.patch('/:projectId/members/:userId', requireProjectRole('owner'), CollaborationController.updateMemberRole);
router.delete('/:projectId/members/:userId', requireProjectRole('owner'), CollaborationController.removeMember);

export default router;
