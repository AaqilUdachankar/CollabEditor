import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { VideoCallRepository } from '../models/VideoCall.js';
import { ProjectRepository } from '../models/Project.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';

export function registerVideoCallHandlers(io: SocketIOServer, socket: Socket): void {
  const user = socket.data.user;
  if (!user) return;

  // 1. Initiate 1-to-1 Private Call
  socket.on('call:invite', async (data, callback) => {
    try {
      const { targetUserId, projectId, callerName, avatarColor } = data;
      if (!targetUserId || !projectId) {
        callback?.({ success: false, error: 'targetUserId and projectId required' });
        return;
      }

      if (targetUserId === user.id) {
        callback?.({ success: false, error: 'Cannot call yourself' });
        return;
      }

      // Verify workspace authorization
      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        callback?.({ success: false, error: 'Workspace project not found' });
        return;
      }

      const isCallerOwner = project.ownerId === user.id;
      const callerMembership = await ProjectMemberRepository.findMembership(projectId, user.id);
      if (!isCallerOwner && !callerMembership && !project.isPublic) {
        callback?.({ success: false, error: 'You do not have access to this workspace' });
        return;
      }

      const isTargetOwner = project.ownerId === targetUserId;
      const targetMembership = await ProjectMemberRepository.findMembership(projectId, targetUserId);
      if (!isTargetOwner && !targetMembership && !project.isPublic) {
        callback?.({ success: false, error: 'Selected member is not part of this workspace' });
        return;
      }

      const callId = data.callId || data.existingCallId || `call_${uuidv4()}`;

      // Persist or log call record
      try {
        await VideoCallRepository.create({
          id: uuidv4(),
          callId,
          callerId: user.id,
          receiverId: targetUserId,
          workspaceId: projectId,
          status: 'ringing',
          startedAt: new Date().toISOString(),
          endedAt: null,
          metadata: {
            callerName: callerName || user.username,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Continue if duplicate for group call
      }

      // Deliver private incoming call signal ONLY to the target user's personal room
      io.to(`user:${targetUserId}`).emit('call:incoming', {
        callId,
        callerId: user.id,
        callerName: callerName || user.username,
        avatarColor: avatarColor || '#3b82f6',
        projectId,
      });

      callback?.({ success: true, callId });
    } catch (err: any) {
      console.error('[VideoCall invite Error]', err);
      callback?.({ success: false, error: err.message || 'Call failed to initiate' });
    }
  });

  // 2. Accept Incoming Call
  socket.on('call:accept', async (data) => {
    try {
      const { callId, targetUserId } = data;
      if (!callId || !targetUserId) return;

      await VideoCallRepository.updateStatus(callId, 'connected', undefined, {
        connectedAt: new Date().toISOString(),
      });

      // Notify caller that call was accepted
      io.to(`user:${targetUserId}`).emit('call:accept', {
        callId,
        responderId: user.id,
        responderName: user.username,
      });
    } catch (err) {
      console.error('[VideoCall accept Error]', err);
    }
  });

  // 3. Reject Call
  socket.on('call:reject', async (data) => {
    try {
      const { callId, targetUserId, reason } = data;
      if (!callId || !targetUserId) return;

      await VideoCallRepository.updateStatus(callId, 'rejected', new Date().toISOString(), {
        reason: reason || 'Declined',
      });

      io.to(`user:${targetUserId}`).emit('call:reject', {
        callId,
        reason: reason || 'Call declined',
      });
    } catch (err) {
      console.error('[VideoCall reject Error]', err);
    }
  });

  // 4. WebRTC SDP Offer
  socket.on('call:offer', (data) => {
    const { callId, targetUserId, sdp } = data;
    if (!targetUserId || !sdp) return;

    // Relay SDP offer exclusively to target user
    io.to(`user:${targetUserId}`).emit('call:offer', {
      callId,
      callerId: user.id,
      sdp,
    });
  });

  // 5. WebRTC SDP Answer
  socket.on('call:answer', (data) => {
    const { callId, targetUserId, sdp } = data;
    if (!targetUserId || !sdp) return;

    // Relay SDP answer exclusively to caller
    io.to(`user:${targetUserId}`).emit('call:answer', {
      callId,
      responderId: user.id,
      sdp,
    });
  });

  // 6. WebRTC ICE Candidate Exchange
  socket.on('call:ice-candidate', (data) => {
    const { callId, targetUserId, candidate } = data;
    if (!targetUserId || !candidate) return;

    io.to(`user:${targetUserId}`).emit('call:ice-candidate', {
      callId,
      senderId: user.id,
      candidate,
    });
  });

  // 7. End Call
  socket.on('call:end', async (data) => {
    try {
      const { callId, targetUserId, durationSeconds } = data;
      if (!callId) return;

      await VideoCallRepository.updateStatus(callId, 'ended', new Date().toISOString(), {
        durationSeconds: durationSeconds || 0,
        endedBy: user.id,
      });

      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:end', {
          callId,
          endedBy: user.id,
        });
      }
    } catch (err) {
      console.error('[VideoCall end Error]', err);
    }
  });
}
