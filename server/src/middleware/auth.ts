import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { ProjectMemberRepository, ProjectRole } from '../models/ProjectMember.js';
import { ProjectRepository } from '../models/Project.js';
import { UserRepository, UserRole, UserStatus } from '../models/User.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role?: UserRole;
    status?: UserStatus;
  };
  projectMemberRole?: ProjectRole;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    const userDoc = await UserRepository.findById(decoded.id);

    if (userDoc && userDoc.status === 'suspended') {
      res.status(403).json({ error: 'Forbidden: Account has been suspended.' });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
      role: userDoc?.role || decoded.role || 'user',
      status: userDoc?.status || 'active',
    };

    // Update lastActive timestamp non-blockingly
    if (userDoc) {
      UserRepository.updateLastActive(userDoc.id).catch(() => {});
    }

    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export async function requireAdminRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await UserRepository.findById(req.user.id);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Platform admin privileges required' });
    return;
  }

  if (user.status === 'suspended') {
    res.status(403).json({ error: 'Forbidden: Account suspended' });
    return;
  }

  req.user.role = user.role;
  next();
}

export function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
      };
    } catch {
      // Ignore optional auth failures
    }
  }
  next();
}

export function requireProjectRole(minRole: ProjectRole = 'viewer') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Owner has highest privileges
    if (project.ownerId === req.user.id) {
      req.projectMemberRole = 'owner';
      next();
      return;
    }

    let membership = await ProjectMemberRepository.findMembership(projectId, req.user.id);
    if (!membership && project.isPublic) {
      membership = await ProjectMemberRepository.addMember({
        id: uuidv4(),
        projectId,
        userId: req.user.id,
        role: 'editor',
        joinedAt: new Date().toISOString(),
      });
    }

    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this project' });
      return;
    }

    req.projectMemberRole = membership.role;

    // Role hierarchy: owner > editor > viewer
    if (minRole === 'owner' && membership.role !== 'owner') {
      res.status(403).json({ error: 'Forbidden: Owner role required' });
      return;
    }

    if (minRole === 'editor' && membership.role === 'viewer') {
      res.status(403).json({ error: 'Forbidden: Edit permissions required. You are currently a viewer.' });
      return;
    }

    next();
  };
}
