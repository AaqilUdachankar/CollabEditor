import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { UserRepository, UserRole, UserStatus } from '../models/User.js';
import { ProjectRepository } from '../models/Project.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { ActivityRepository, ActivityEventType } from '../models/Activity.js';
import { AuditLogRepository } from '../models/AuditLog.js';
import { getAllLiveSessions } from '../sockets/index.js';
import { HealthMetricsService } from '../services/healthMetricsService.js';
import { recordAuditLog, recordActivity } from '../services/activitySanitizer.js';

export class AdminController {
  // 1. Overview
  static async getOverview(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const [registeredUsersCount, totalWorkspaces, liveSessionsData, healthMetrics, recentActivities] =
        await Promise.all([
          UserRepository.count(),
          ProjectRepository.count(),
          getAllLiveSessions(),
          HealthMetricsService.getMetrics(),
          ActivityRepository.getRecent(10),
        ]);

      res.json({
        overview: {
          registeredUsers: registeredUsersCount,
          activeUsers: liveSessionsData.activeUsersCount,
          activeSessions: liveSessionsData.activeSessionsCount,
          activeWorkspaces: liveSessionsData.activeWorkspacesCount,
          totalWorkspaces,
          recentActivities,
          healthCounts: {
            totalErrors: healthMetrics.errors.totalErrors,
            executionErrors: healthMetrics.executions.failed,
            saveFailures: healthMetrics.errors.saveFailures,
            apiErrors: healthMetrics.errors.apiErrors,
            websocketErrors: healthMetrics.errors.websocketErrors,
            timeoutCount: healthMetrics.executions.timeoutCount,
            systemStatus: healthMetrics.system.status,
          },
        },
      });
    } catch (err: any) {
      console.error('[Admin Overview Error]', err);
      res.status(500).json({ error: 'Failed to retrieve admin overview metrics' });
    }
  }

  // 2. Users Management
  static async getUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = (req.query.search as string || '').toLowerCase().trim();
      const roleFilter = req.query.role as string;
      const statusFilter = req.query.status as string;
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
      const skip = (page - 1) * limit;

      const allUsers = await UserRepository.findAll();
      const allMemberships = await ProjectMemberRepository.findAll();
      const allProjects = await ProjectRepository.findAll();

      const projectMap = new Map(allProjects.map((p) => [p.id, p]));

      let filtered = allUsers.filter((u) => {
        if (roleFilter && u.role !== roleFilter) return false;
        if (statusFilter && u.status !== statusFilter) return false;
        if (search) {
          const matchUsername = u.username.toLowerCase().includes(search);
          const matchEmail = u.email.toLowerCase().includes(search);
          if (!matchUsername && !matchEmail) return false;
        }
        return true;
      });

      // Sort newest / last active first
      filtered.sort((a, b) => new Date(b.lastActive || b.createdAt).getTime() - new Date(a.lastActive || a.createdAt).getTime());

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);

      const enriched = paginated.map((user) => {
        const userMemberships = allMemberships.filter((m) => m.userId === user.id);
        const ownedProjects = allProjects.filter((p) => p.ownerId === user.id);

        const workspaces = [
          ...ownedProjects.map((p) => ({ id: p.id, name: p.name, role: 'owner' })),
          ...userMemberships
            .filter((m) => !ownedProjects.some((op) => op.id === m.projectId))
            .map((m) => ({
              id: m.projectId,
              name: projectMap.get(m.projectId)?.name || 'Shared Workspace',
              role: m.role,
            })),
        ];

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarColor: user.avatarColor,
          role: user.role,
          status: user.status,
          lastActive: user.lastActive,
          createdAt: user.createdAt,
          workspaceCount: workspaces.length,
          workspaces,
        };
      });

      res.json({
        users: enriched,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: any) {
      console.error('[Admin Users Error]', err);
      res.status(500).json({ error: 'Failed to retrieve users' });
    }
  }

  // Update user role
  static async updateUserRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      const targetUserId = String(req.params.userId);
      const { role } = req.body;

      if (!role || !['admin', 'user'].includes(role)) {
        res.status(400).json({ error: "Role must be 'admin' or 'user'" });
        return;
      }

      const targetUser = await UserRepository.findById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const prevRole = targetUser.role;
      const updated = await UserRepository.update(targetUserId, { role: role as UserRole });

      // Record Audit Log with actor, action, target and timestamp
      await recordAuditLog({
        actorId: req.user!.id,
        actorUsername: req.user!.username,
        actorEmail: req.user!.email,
        action: 'user:change_role',
        targetType: 'user',
        targetId: targetUserId,
        targetName: targetUser.username,
        details: { previousRole: prevRole, newRole: role },
      });

      // Record Activity
      await recordActivity({
        userId: req.user!.id,
        username: req.user!.username,
        userEmail: req.user!.email,
        eventType: 'admin:role_change',
        action: `Changed role of ${targetUser.username} from ${prevRole} to ${role}`,
        metadata: { targetUserId, targetUsername: targetUser.username, previousRole: prevRole, newRole: role },
      });

      res.json({ user: updated, message: `User role updated to ${role}` });
    } catch (err: any) {
      console.error('[Admin Update Role Error]', err);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }

  // Update user status
  static async updateUserStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const targetUserId = String(req.params.userId);
      const { status } = req.body;

      if (!status || !['active', 'suspended'].includes(status)) {
        res.status(400).json({ error: "Status must be 'active' or 'suspended'" });
        return;
      }

      const targetUser = await UserRepository.findById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const prevStatus = targetUser.status;
      const updated = await UserRepository.update(targetUserId, { status: status as UserStatus });

      // Record Audit Log with actor, action, target and timestamp
      await recordAuditLog({
        actorId: req.user!.id,
        actorUsername: req.user!.username,
        actorEmail: req.user!.email,
        action: 'user:change_status',
        targetType: 'user',
        targetId: targetUserId,
        targetName: targetUser.username,
        details: { previousStatus: prevStatus, newStatus: status },
      });

      // Record Activity
      await recordActivity({
        userId: req.user!.id,
        username: req.user!.username,
        userEmail: req.user!.email,
        eventType: 'admin:status_change',
        action: `Changed account status of ${targetUser.username} to ${status}`,
        metadata: { targetUserId, targetUsername: targetUser.username, previousStatus: prevStatus, newStatus: status },
      });

      res.json({ user: updated, message: `User status updated to ${status}` });
    } catch (err: any) {
      console.error('[Admin Update Status Error]', err);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }

  // 3. Live Sessions
  static async getLiveSessions(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await getAllLiveSessions();
      res.json(data);
    } catch (err: any) {
      console.error('[Admin Live Sessions Error]', err);
      res.status(500).json({ error: 'Failed to retrieve live sessions' });
    }
  }

  // 4. Workspaces
  static async getWorkspaces(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = (req.query.search as string || '').toLowerCase().trim();
      const visibility = req.query.visibility as string;
      const template = req.query.template as string;
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
      const skip = (page - 1) * limit;

      const [allProjects, allUsers, allMemberships, allActivities] = await Promise.all([
        ProjectRepository.findAll(),
        UserRepository.findAll(),
        ProjectMemberRepository.findAll(),
        ActivityRepository.findPlatform({ limit: 500 }).catch(() => ({ activities: [], total: 0 })),
      ]);

      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      let filtered = allProjects.filter((p) => {
        if (visibility === 'public' && !p.isPublic) return false;
        if (visibility === 'private' && p.isPublic) return false;
        if (template && p.template !== template) return false;
        if (search) {
          const matchName = p.name.toLowerCase().includes(search);
          const matchDesc = (p.description || '').toLowerCase().includes(search);
          if (!matchName && !matchDesc) return false;
        }
        return true;
      });

      filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);

      const enriched = paginated.map((project) => {
        const owner = userMap.get(project.ownerId);
        const members = allMemberships.filter((m) => m.projectId === project.id);
        const projectActivities = allActivities.activities.filter((a) => a.projectId === project.id);
        const lastActivity = projectActivities.length > 0 ? projectActivities[0].createdAt : project.updatedAt;

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          owner: {
            id: project.ownerId,
            username: owner?.username || 'Unknown',
            email: owner?.email || '',
          },
          template: project.template,
          isPublic: project.isPublic,
          membersCount: members.length + 1, // +1 for owner
          members: members.map((m) => {
            const u = userMap.get(m.userId);
            return {
              userId: m.userId,
              username: u?.username || 'Member',
              role: m.role,
            };
          }),
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          lastActivity,
        };
      });

      res.json({
        workspaces: enriched,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: any) {
      console.error('[Admin Workspaces Error]', err);
      res.status(500).json({ error: 'Failed to retrieve workspaces' });
    }
  }

  // 5. Activity Timeline
  static async getActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = (req.query.search as string || '').trim();
      const eventType = (req.query.eventType as string || '').trim() || undefined;
      const workspaceId = (req.query.workspaceId as string || '').trim() || undefined;
      const userId = (req.query.userId as string || '').trim() || undefined;
      const startDate = (req.query.startDate as string || '').trim() || undefined;
      const endDate = (req.query.endDate as string || '').trim() || undefined;
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '30', 10)));
      const skip = (page - 1) * limit;

      const result = await ActivityRepository.findPlatform({
        search,
        eventType,
        projectId: workspaceId,
        userId,
        startDate,
        endDate,
        limit,
        skip,
      });

      res.json({
        activities: result.activities,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (err: any) {
      console.error('[Admin Activities Error]', err);
      res.status(500).json({ error: 'Failed to retrieve platform activities' });
    }
  }

  // 6. Performance & Health
  static async getPerformance(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const metrics = await HealthMetricsService.getMetrics();
      res.json(metrics);
    } catch (err: any) {
      console.error('[Admin Performance Error]', err);
      res.status(500).json({ error: 'Failed to retrieve performance metrics' });
    }
  }

  // 7. Audit Log
  static async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = (req.query.search as string || '').trim();
      const actorId = (req.query.actorId as string || '').trim() || undefined;
      const action = (req.query.action as string || '').trim() || undefined;
      const targetType = (req.query.targetType as string || '').trim() || undefined;
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '30', 10)));
      const skip = (page - 1) * limit;

      const result = await AuditLogRepository.find({
        search,
        actorId,
        action,
        targetType,
        limit,
        skip,
      });

      res.json({
        auditLogs: result.logs,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (err: any) {
      console.error('[Admin Audit Log Error]', err);
      res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
  }
}

