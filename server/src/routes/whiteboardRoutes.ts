import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, requireProjectRole, AuthRequest } from '../middleware/auth.js';
import { PrivateWhiteboardRepository } from '../models/PrivateWhiteboard.js';
import { WhiteboardOperationRepository } from '../models/WhiteboardOperation.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { ProjectRepository } from '../models/Project.js';
import { UserRepository } from '../models/User.js';

const router = Router();

// List all private whiteboards the current user has access to in this project
router.get('/:projectId/whiteboards', authMiddleware, requireProjectRole('viewer'), async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const boards = await PrivateWhiteboardRepository.findByWorkspaceAndUser(projectId, userId);

    // Enrich with participant usernames/avatar info
    const enriched = await Promise.all(
      boards.map(async (board) => {
        const participantDetails = await Promise.all(
          board.participantIds.map(async (pid) => {
            const u = await UserRepository.findById(pid);
            return u ? { id: u.id, username: u.username, avatarColor: u.avatarColor } : { id: pid, username: 'Unknown' };
          })
        );
        return {
          ...board,
          participants: participantDetails,
        };
      })
    );

    res.json({ whiteboards: enriched });
  } catch (err: any) {
    console.error('[Get Whiteboards Error]', err);
    res.status(500).json({ error: 'Failed to retrieve private whiteboards' });
  }
});

// Get a specific private whiteboard by boardId
router.get('/:projectId/whiteboards/:boardId', authMiddleware, requireProjectRole('viewer'), async (req: AuthRequest, res) => {
  try {
    const { projectId, boardId } = req.params;
    const userId = req.user!.id;

    const board = await PrivateWhiteboardRepository.findByBoardId(boardId);
    if (!board || board.workspaceId !== projectId) {
      res.status(404).json({ error: 'Whiteboard not found in this workspace' });
      return;
    }

    // Security check: Only invited participants can view the private board
    if (!board.participantIds.includes(userId)) {
      res.status(403).json({ error: 'Access denied: You are not an invited participant on this private whiteboard.' });
      return;
    }

    // Get recent operations
    const operations = await WhiteboardOperationRepository.findByBoard(boardId, 200);

    // Enrich participants
    const participants = await Promise.all(
      board.participantIds.map(async (pid) => {
        const u = await UserRepository.findById(pid);
        return u ? { id: u.id, username: u.username, avatarColor: u.avatarColor } : { id: pid, username: 'Unknown' };
      })
    );

    res.json({
      whiteboard: {
        ...board,
        participants,
      },
      operations,
    });
  } catch (err: any) {
    console.error('[Get Whiteboard Detail Error]', err);
    res.status(500).json({ error: 'Failed to retrieve whiteboard details' });
  }
});

// Create a new private whiteboard for selected participants
router.post('/:projectId/whiteboards', authMiddleware, requireProjectRole('editor'), async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;
    const { title, targetUserId, initialCanvasData } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: 'Target user ID is required to create a private whiteboard' });
      return;
    }

    // Verify target user exists and belongs to the workspace
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const isTargetOwner = project.ownerId === targetUserId;
    const targetMembership = await ProjectMemberRepository.findMembership(projectId, targetUserId);
    if (!isTargetOwner && !targetMembership && !project.isPublic) {
      res.status(400).json({ error: 'Selected participant is not a member of this workspace' });
      return;
    }

    const boardId = `wb_${uuidv4()}`;
    const participantIds = Array.from(new Set([userId, targetUserId]));

    const newBoard = await PrivateWhiteboardRepository.create({
      id: uuidv4(),
      boardId,
      ownerId: userId,
      participantIds,
      workspaceId: projectId,
      title: title?.trim() || 'Private Collaborative Board',
      canvasData: initialCanvasData || {
        elements: [],
        viewport: { zoom: 1, panX: 0, panY: 0 },
        version: 1,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({ whiteboard: newBoard });
  } catch (err: any) {
    console.error('[Create Whiteboard Error]', err);
    res.status(500).json({ error: 'Failed to create private whiteboard' });
  }
});

// Update whiteboard canvas data
router.put('/:projectId/whiteboards/:boardId', authMiddleware, requireProjectRole('editor'), async (req: AuthRequest, res) => {
  try {
    const { projectId, boardId } = req.params;
    const userId = req.user!.id;
    const { canvasData } = req.body;

    const board = await PrivateWhiteboardRepository.findByBoardId(boardId);
    if (!board || board.workspaceId !== projectId) {
      res.status(404).json({ error: 'Whiteboard not found' });
      return;
    }

    if (!board.participantIds.includes(userId)) {
      res.status(403).json({ error: 'Access denied: You are not authorized to edit this whiteboard' });
      return;
    }

    const updated = await PrivateWhiteboardRepository.updateCanvasData(boardId, canvasData);
    res.json({ whiteboard: updated });
  } catch (err: any) {
    console.error('[Update Whiteboard Error]', err);
    res.status(500).json({ error: 'Failed to update whiteboard' });
  }
});

// Invite friend or collaborator to an active whiteboard
router.post('/:projectId/whiteboards/:boardId/invite', authMiddleware, requireProjectRole('viewer'), async (req: AuthRequest, res) => {
  try {
    const { projectId, boardId } = req.params;
    const userId = req.user!.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: 'targetUserId is required' });
      return;
    }

    const board = await PrivateWhiteboardRepository.findByBoardId(boardId);
    if (!board || board.workspaceId !== projectId) {
      res.status(404).json({ error: 'Whiteboard not found' });
      return;
    }

    const isProjectOwner = req.projectMemberRole === 'owner';
    const isBoardOwner = board.ownerId === userId;
    const isParticipant = Array.isArray(board.participantIds) && board.participantIds.includes(userId);

    if (!isProjectOwner && !isBoardOwner && !isParticipant) {
      res.status(403).json({ error: 'Access denied: You cannot invite users to this whiteboard' });
      return;
    }

    const updated = await PrivateWhiteboardRepository.addParticipant(boardId, targetUserId);
    res.json({ whiteboard: updated, message: 'Friend added to whiteboard' });
  } catch (err: any) {
    console.error('[Invite to Whiteboard Error]', err);
    res.status(500).json({ error: 'Failed to invite to whiteboard' });
  }
});

// Delete or close private whiteboard
router.delete('/:projectId/whiteboards/:boardId', authMiddleware, requireProjectRole('viewer'), async (req: AuthRequest, res) => {
  try {
    const { projectId, boardId } = req.params;
    const userId = req.user!.id;

    const board = await PrivateWhiteboardRepository.findByBoardId(boardId);
    if (!board || board.workspaceId !== projectId) {
      res.status(404).json({ error: 'Whiteboard not found' });
      return;
    }

    const isProjectOwner = req.projectMemberRole === 'owner';
    const isBoardOwner = board.ownerId === userId;
    const isParticipant = Array.isArray(board.participantIds) && board.participantIds.includes(userId);

    if (!isProjectOwner && !isBoardOwner && !isParticipant) {
      res.status(403).json({ error: 'Access denied: You cannot delete this whiteboard' });
      return;
    }

    await PrivateWhiteboardRepository.deleteByBoardId(boardId);
    await WhiteboardOperationRepository.clearBoardOperations(boardId);

    res.json({ message: 'Whiteboard deleted successfully', boardId });
  } catch (err: any) {
    console.error('[Delete Whiteboard Error]', err);
    res.status(500).json({ error: 'Failed to delete whiteboard' });
  }
});

export default router;
