import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { PrivateWhiteboardRepository } from '../models/PrivateWhiteboard.js';
import { WhiteboardOperationRepository } from '../models/WhiteboardOperation.js';
import { ProjectRepository } from '../models/Project.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';

export function registerWhiteboardHandlers(io: SocketIOServer, socket: Socket): void {
  const user = socket.data.user;
  if (!user) return;

  // 1. Send Private Whiteboard Invitation
  socket.on('board:invite', async (data, callback) => {
    try {
      const { targetUserId, projectId, title } = data;
      if (!targetUserId || !projectId) {
        callback?.({ success: false, error: 'targetUserId and projectId are required' });
        return;
      }

      if (targetUserId === user.id) {
        callback?.({ success: false, error: 'Cannot invite yourself' });
        return;
      }

      // Security check: verify workspace membership
      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        callback?.({ success: false, error: 'Project not found' });
        return;
      }

      const isCallerOwner = project.ownerId === user.id;
      const callerMembership = await ProjectMemberRepository.findMembership(projectId, user.id);
      if (!isCallerOwner && !callerMembership && !project.isPublic) {
        callback?.({ success: false, error: 'Unauthorized access to project' });
        return;
      }

      const isTargetOwner = project.ownerId === targetUserId;
      const targetMembership = await ProjectMemberRepository.findMembership(projectId, targetUserId);
      if (!isTargetOwner && !targetMembership && !project.isPublic) {
        callback?.({ success: false, error: 'Invited teammate is not part of this workspace' });
        return;
      }

      const boardId = `wb_${uuidv4()}`;
      const participantIds = Array.from(new Set([user.id, targetUserId]));

      const newBoard = await PrivateWhiteboardRepository.create({
        id: uuidv4(),
        boardId,
        ownerId: user.id,
        participantIds,
        workspaceId: projectId,
        title: title?.trim() || `Collaboration with ${user.username}`,
        canvasData: {
          elements: [],
          viewport: { zoom: 1, panX: 0, panY: 0 },
          version: 1,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Deliver private invite exclusively to target user
      io.to(`user:${targetUserId}`).emit('board:incoming', {
        boardId,
        callerId: user.id,
        callerName: user.username,
        avatarColor: user.avatarColor || '#3b82f6',
        title: newBoard.title,
        projectId,
      });

      callback?.({ success: true, boardId, board: newBoard });
    } catch (err: any) {
      console.error('[Whiteboard invite Error]', err);
      callback?.({ success: false, error: err.message || 'Failed to send whiteboard invitation' });
    }
  });

  // 2. Accept Whiteboard Invitation
  socket.on('board:accept', (data) => {
    const { boardId, targetUserId } = data;
    if (!boardId || !targetUserId) return;

    io.to(`user:${targetUserId}`).emit('board:accept', {
      boardId,
      responderId: user.id,
      responderName: user.username,
    });
  });

  // 3. Reject Whiteboard Invitation
  socket.on('board:reject', (data) => {
    const { boardId, targetUserId, reason } = data;
    if (!boardId || !targetUserId) return;

    io.to(`user:${targetUserId}`).emit('board:reject', {
      boardId,
      reason: reason || 'Invitation declined',
    });
  });

  // 4. Join Private Whiteboard Session Room
  socket.on('board:join', async (data, callback) => {
    try {
      const { boardId } = data;
      if (!boardId) {
        callback?.({ success: false, error: 'boardId required' });
        return;
      }

      const board = await PrivateWhiteboardRepository.findByBoardId(boardId);
      if (!board) {
        callback?.({ success: false, error: 'Whiteboard does not exist' });
        return;
      }

      // Security check: strictly restrict to participants
      if (!board.participantIds.includes(user.id)) {
        callback?.({ success: false, error: 'Access denied: You are not authorized on this private board' });
        return;
      }

      socket.join(`board:${boardId}`);

      // Notify others in board room
      socket.to(`board:${boardId}`).emit('board:user-joined', {
        userId: user.id,
        username: user.username,
      });

      callback?.({
        success: true,
        board,
      });
    } catch (err: any) {
      console.error('[Whiteboard join Error]', err);
      callback?.({ success: false, error: err.message });
    }
  });

  // 5. Leave Whiteboard Session Room
  socket.on('board:leave', ({ boardId }) => {
    if (boardId) {
      socket.leave(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit('board:user-left', {
        userId: user.id,
        username: user.username,
      });
    }
  });

  // 6. Real-time Operation (Draw, Add Shape, Sticky Note, Edit, Delete, Clear)
  socket.on('board:operation', async (data) => {
    try {
      const { boardId, operation, canvasSnapshot } = data;
      if (!boardId || !operation) return;

      const board = await PrivateWhiteboardRepository.findByBoardId(boardId);
      if (!board || !board.participantIds.includes(user.id)) {
        return; // Unauthorized operation rejected
      }

      // Record operation in persistence layer
      await WhiteboardOperationRepository.record({
        id: uuidv4(),
        boardId,
        userId: user.id,
        operationType: operation.type,
        operationData: operation,
        timestamp: new Date().toISOString(),
      });

      // Update snapshot if provided
      if (canvasSnapshot) {
        await PrivateWhiteboardRepository.updateCanvasData(boardId, canvasSnapshot);
      }

      // Broadcast operation strictly to other participant(s) in this private board room
      socket.to(`board:${boardId}`).emit('board:operation', {
        operation,
        userId: user.id,
      });
    } catch (err) {
      console.error('[Whiteboard operation Error]', err);
    }
  });

  // 7. Live Cursor Tracking with User Labels
  socket.on('board:cursor', (data) => {
    const { boardId, x, y, avatarColor } = data;
    if (!boardId) return;

    socket.to(`board:${boardId}`).emit('board:cursor', {
      userId: user.id,
      username: user.username,
      avatarColor: avatarColor || user.avatarColor || '#3b82f6',
      x,
      y,
    });
  });

  // 8. Synchronize Full Canvas Snapshot
  socket.on('board:sync', async (data) => {
    try {
      const { boardId, canvasData } = data;
      if (!boardId || !canvasData) return;

      const board = await PrivateWhiteboardRepository.findByBoardId(boardId);
      if (!board || !board.participantIds.includes(user.id)) return;

      await PrivateWhiteboardRepository.updateCanvasData(boardId, canvasData);
      socket.to(`board:${boardId}`).emit('board:sync', { canvasData });
    } catch (err) {
      console.error('[Whiteboard sync Error]', err);
    }
  });

  // 9. Undo / Redo
  socket.on('board:undo', (data) => {
    const { boardId, elementId } = data;
    if (!boardId) return;
    socket.to(`board:${boardId}`).emit('board:undo', { elementId, userId: user.id });
  });

  socket.on('board:redo', (data) => {
    const { boardId, element } = data;
    if (!boardId) return;
    socket.to(`board:${boardId}`).emit('board:redo', { element, userId: user.id });
  });
}
