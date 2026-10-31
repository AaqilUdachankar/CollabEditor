import { Router } from 'express';
import { authMiddleware, requireProjectRole, AuthRequest } from '../middleware/auth.js';
import { VideoCallRepository } from '../models/VideoCall.js';
import { UserRepository } from '../models/User.js';

const router = Router();

// Get call history for current workspace
router.get('/:projectId/calls/history', authMiddleware, requireProjectRole('viewer'), async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const calls = await VideoCallRepository.findByWorkspace(projectId);

    // Filter calls involving the current user only (for privacy)
    const userCalls = calls.filter((c) => c.callerId === userId || c.receiverId === userId);

    const enriched = await Promise.all(
      userCalls.map(async (c) => {
        const caller = await UserRepository.findById(c.callerId);
        const receiver = await UserRepository.findById(c.receiverId);
        return {
          ...c,
          caller: caller ? { id: caller.id, username: caller.username, avatarColor: caller.avatarColor } : null,
          receiver: receiver ? { id: receiver.id, username: receiver.username, avatarColor: receiver.avatarColor } : null,
        };
      })
    );

    res.json({ calls: enriched });
  } catch (err: any) {
    console.error('[Call History Error]', err);
    res.status(500).json({ error: 'Failed to retrieve call history' });
  }
});

// Get call detail
router.get('/:projectId/calls/:callId', authMiddleware, requireProjectRole('viewer'), async (req: AuthRequest, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user!.id;

    const call = await VideoCallRepository.findByCallId(callId);
    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    if (call.callerId !== userId && call.receiverId !== userId) {
      res.status(403).json({ error: 'Access denied: You were not a participant in this call.' });
      return;
    }

    res.json({ call });
  } catch (err: any) {
    console.error('[Call Detail Error]', err);
    res.status(500).json({ error: 'Failed to retrieve call details' });
  }
});

export default router;
