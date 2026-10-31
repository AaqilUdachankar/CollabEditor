import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { ProjectRepository } from '../models/Project.js';
import { registerVideoCallHandlers } from './videoCallHandler.js';
import { registerWhiteboardHandlers } from './whiteboardHandler.js';
import { UserRepository } from '../models/User.js';
import { recordActivity, sanitizePath } from '../services/activitySanitizer.js';
import { HealthMetricsService } from '../services/healthMetricsService.js';

let ioInstance: SocketIOServer | null = null;

export interface PresenceUser {
  socketId: string;
  userId: string;
  username: string;
  avatarColor: string;
  activeFileId: string | null;
  activeFilePath: string | null;
  cursorLine: number;
  cursorCol: number;
  connectedAt: number;
  lastActiveAt: number;
  connectionState: 'connected' | 'reconnecting' | 'idle';
}

// Map of projectId -> Map of socketId -> PresenceUser
const projectPresenceMap: Map<string, Map<string, PresenceUser>> = new Map();

export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  ioInstance = io;

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token || typeof token !== 'string') {
        HealthMetricsService.recordWebSocketError();
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as any;
      const userDoc = await UserRepository.findById(decoded.id);

      if (userDoc && userDoc.status === 'suspended') {
        HealthMetricsService.recordWebSocketError();
        return next(new Error('User account is suspended'));
      }

      socket.data.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
      };
      next();
    } catch (err) {
      HealthMetricsService.recordWebSocketError();
      next(new Error('Invalid socket authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    // Join private personal user room for direct 1-to-1 private signaling and invites
    socket.join(`user:${user.id}`);

    // Register private 1-to-1 video calling and whiteboard handlers
    registerVideoCallHandlers(io, socket);
    registerWhiteboardHandlers(io, socket);

    socket.on('join:project', async ({ projectId, avatarColor }) => {
      try {
        const project = await ProjectRepository.findById(projectId);
        if (!project) {
          socket.emit('error', { message: 'Project not found' });
          return;
        }

        const isOwner = project.ownerId === user.id;
        const membership = await ProjectMemberRepository.findMembership(projectId, user.id);
        if (!isOwner && !membership && !project.isPublic) {
          socket.emit('error', { message: 'Unauthorized project access' });
          return;
        }

        socket.join(`project:${projectId}`);

        if (!projectPresenceMap.has(projectId)) {
          projectPresenceMap.set(projectId, new Map());
        }

        const roomMap = projectPresenceMap.get(projectId)!;
        const now = Date.now();
        const presence: PresenceUser = {
          socketId: socket.id,
          userId: user.id,
          username: user.username,
          avatarColor: avatarColor || '#3b82f6',
          activeFileId: null,
          activeFilePath: null,
          cursorLine: 1,
          cursorCol: 1,
          connectedAt: now,
          lastActiveAt: now,
          connectionState: 'connected',
        };

        roomMap.set(socket.id, presence);

        // Record session connect activity
        recordActivity({
          projectId,
          userId: user.id,
          username: user.username,
          userEmail: user.email,
          eventType: 'session:connect',
          action: `${user.username} joined workspace session`,
          metadata: {
            socketId: socket.id,
            workspaceName: project.name,
          },
        }).catch(() => {});

        // Broadcast updated presence list to room
        io.to(`project:${projectId}`).emit('presence:update', {
          projectId,
          users: Array.from(roomMap.values()),
        });
      } catch (err) {
        console.error('[Socket Join Error]', err);
        HealthMetricsService.recordWebSocketError();
      }
    });

    socket.on('presence:activity', ({ projectId, fileId, filePath, cursorLine, cursorCol }) => {
      const roomMap = projectPresenceMap.get(projectId);
      if (roomMap && roomMap.has(socket.id)) {
        const current = roomMap.get(socket.id)!;
        current.activeFileId = fileId ?? current.activeFileId;
        current.activeFilePath = filePath ? sanitizePath(filePath) : current.activeFilePath;
        current.cursorLine = cursorLine ?? current.cursorLine;
        current.cursorCol = cursorCol ?? current.cursorCol;
        current.lastActiveAt = Date.now();

        socket.to(`project:${projectId}`).emit('presence:activity', {
          socketId: socket.id,
          userId: user.id,
          username: user.username,
          avatarColor: current.avatarColor,
          activeFileId: current.activeFileId,
          activeFilePath: current.activeFilePath,
          cursorLine: current.cursorLine,
          cursorCol: current.cursorCol,
        });
      }
    });

    socket.on('leave:project', ({ projectId }) => {
      socket.leave(`project:${projectId}`);
      const roomMap = projectPresenceMap.get(projectId);
      if (roomMap) {
        roomMap.delete(socket.id);
        io.to(`project:${projectId}`).emit('presence:update', {
          projectId,
          users: Array.from(roomMap.values()),
        });

        recordActivity({
          projectId,
          userId: user.id,
          username: user.username,
          userEmail: user.email,
          eventType: 'session:disconnect',
          action: `${user.username} left workspace session`,
        }).catch(() => {});
      }
    });

    socket.on('disconnect', () => {
      for (const [projectId, roomMap] of projectPresenceMap.entries()) {
        if (roomMap.has(socket.id)) {
          roomMap.delete(socket.id);
          io.to(`project:${projectId}`).emit('presence:update', {
            projectId,
            users: Array.from(roomMap.values()),
          });

          recordActivity({
            projectId,
            userId: user.id,
            username: user.username,
            userEmail: user.email,
            eventType: 'session:disconnect',
            action: `${user.username} disconnected from workspace session`,
          }).catch(() => {});
        }
      }
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

export interface LiveSessionWorkspace {
  workspaceId: string;
  workspaceName: string;
  ownerId: string;
  participantsCount: number;
  participants: Array<{
    socketId: string;
    userId: string;
    username: string;
    avatarColor: string;
    connectionState: string;
    connectedAt: string;
    durationSeconds: number;
    activeFile: {
      fileId: string | null;
      path: string | null;
      line: number;
      col: number;
    } | null;
  }>;
}

export async function getAllLiveSessions(): Promise<{
  activeSessionsCount: number;
  activeUsersCount: number;
  activeWorkspacesCount: number;
  workspaces: LiveSessionWorkspace[];
}> {
  const result: LiveSessionWorkspace[] = [];
  const activeUserSet = new Set<string>();
  let totalSessions = 0;

  for (const [projectId, roomMap] of projectPresenceMap.entries()) {
    if (roomMap.size === 0) continue;

    const project = await ProjectRepository.findById(projectId);
    const participants: LiveSessionWorkspace['participants'] = [];

    for (const p of roomMap.values()) {
      activeUserSet.add(p.userId);
      totalSessions++;
      participants.push({
        socketId: p.socketId,
        userId: p.userId,
        username: p.username,
        avatarColor: p.avatarColor,
        connectionState: p.connectionState || 'connected',
        connectedAt: new Date(p.connectedAt).toISOString(),
        durationSeconds: Math.floor((Date.now() - p.connectedAt) / 1000),
        activeFile: p.activeFilePath
          ? {
              fileId: p.activeFileId,
              path: sanitizePath(p.activeFilePath),
              line: p.cursorLine,
              col: p.cursorCol,
            }
          : null,
      });
    }

    result.push({
      workspaceId: projectId,
      workspaceName: project?.name || 'Workspace',
      ownerId: project?.ownerId || '',
      participantsCount: roomMap.size,
      participants,
    });
  }

  return {
    activeSessionsCount: totalSessions,
    activeUsersCount: activeUserSet.size,
    activeWorkspacesCount: result.length,
    workspaces: result,
  };
}
