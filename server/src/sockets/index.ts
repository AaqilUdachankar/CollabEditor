import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { ProjectRepository } from '../models/Project.js';

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
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as any;
      socket.data.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
      };
      next();
    } catch (err) {
      next(new Error('Invalid socket authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

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
        const presence: PresenceUser = {
          socketId: socket.id,
          userId: user.id,
          username: user.username,
          avatarColor: avatarColor || '#3b82f6',
          activeFileId: null,
          activeFilePath: null,
          cursorLine: 1,
          cursorCol: 1,
        };

        roomMap.set(socket.id, presence);

        // Broadcast updated presence list to room
        io.to(`project:${projectId}`).emit('presence:update', {
          projectId,
          users: Array.from(roomMap.values()),
        });
      } catch (err) {
        console.error('[Socket Join Error]', err);
      }
    });

    socket.on('presence:activity', ({ projectId, fileId, filePath, cursorLine, cursorCol }) => {
      const roomMap = projectPresenceMap.get(projectId);
      if (roomMap && roomMap.has(socket.id)) {
        const current = roomMap.get(socket.id)!;
        current.activeFileId = fileId ?? current.activeFileId;
        current.activeFilePath = filePath ?? current.activeFilePath;
        current.cursorLine = cursorLine ?? current.cursorLine;
        current.cursorCol = cursorCol ?? current.cursorCol;

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
        }
      }
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}
