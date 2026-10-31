import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth.js';
import { InvitationRepository, IInvitation } from '../models/Invitation.js';
import { ProjectMemberRepository, ProjectRole } from '../models/ProjectMember.js';
import { ProjectRepository } from '../models/Project.js';
import { UserRepository } from '../models/User.js';
import { recordActivity } from '../services/activitySanitizer.js';

export class CollaborationController {
  static async createInvitation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { role = 'editor', expiresInDays = 7 } = req.body;
      const userId = req.user!.id;

      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Only owner or editor can invite
      const membership = await ProjectMemberRepository.findMembership(projectId, userId);
      const isOwner = project.ownerId === userId;
      if (!isOwner && membership?.role !== 'editor') {
        res.status(403).json({ error: 'Only owners and editors can invite collaborators' });
        return;
      }

      const token = uuidv4().replace(/-/g, '').substring(0, 16);
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      const invitation: IInvitation = {
        id: uuidv4(),
        token,
        projectId,
        inviterId: userId,
        role: role as ProjectRole,
        expiresAt,
        used: false,
        createdAt: new Date().toISOString(),
      };

      const created = await InvitationRepository.create(invitation);
      res.status(201).json({ invitation: created });
    } catch (err: any) {
      console.error('[Create Invitation Error]', err);
      res.status(500).json({ error: 'Failed to create invitation' });
    }
  }

  static async joinByToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      const userId = req.user!.id;

      if (!token) {
        res.status(400).json({ error: 'Invitation token is required' });
        return;
      }

      const invitation = await InvitationRepository.findByToken(token);
      if (!invitation) {
        res.status(404).json({ error: 'Invalid invitation token' });
        return;
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        res.status(410).json({ error: 'Invitation has expired' });
        return;
      }

      const project = await ProjectRepository.findById(invitation.projectId);
      if (!project) {
        res.status(404).json({ error: 'Project associated with this invitation does not exist' });
        return;
      }

      // Check if already a member
      const existing = await ProjectMemberRepository.findMembership(project.id, userId);
      if (!existing && project.ownerId !== userId) {
        await ProjectMemberRepository.addMember({
          id: uuidv4(),
          projectId: project.id,
          userId,
          role: invitation.role,
          joinedAt: new Date().toISOString(),
        });
      }

      recordActivity({
        projectId: project.id,
        userId: req.user!.id,
        username: req.user!.username,
        userEmail: req.user!.email,
        eventType: 'member:join',
        action: `${req.user!.username} joined workspace with role ${invitation.role}`,
        metadata: {
          role: invitation.role,
        },
      }).catch(() => {});

      res.json({
        message: 'Successfully joined project',
        projectId: project.id,
        project: { ...project, role: invitation.role },
      });
    } catch (err: any) {
      console.error('[Join By Token Error]', err);
      res.status(500).json({ error: 'Failed to process invitation' });
    }
  }

  static async getMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const memberships = await ProjectMemberRepository.findByProject(projectId);
      const members = [];

      // Include owner
      const owner = await UserRepository.findById(project.ownerId);
      if (owner) {
        members.push({
          userId: owner.id,
          username: owner.username,
          email: owner.email,
          avatarColor: owner.avatarColor,
          role: 'owner',
          joinedAt: project.createdAt,
        });
      }

      // Include other members
      for (const m of memberships) {
        if (m.userId === project.ownerId) continue;
        const u = await UserRepository.findById(m.userId);
        if (u) {
          members.push({
            userId: u.id,
            username: u.username,
            email: u.email,
            avatarColor: u.avatarColor,
            role: m.role,
            joinedAt: m.joinedAt,
          });
        }
      }

      res.json({ members });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve members' });
    }
  }

  static async updateMemberRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const userId = String(req.params.userId);
      const { role } = req.body;

      if (!['editor', 'viewer'].includes(role)) {
        res.status(400).json({ error: 'Role must be editor or viewer' });
        return;
      }

      const updated = await ProjectMemberRepository.updateRole(projectId, userId, role);

      recordActivity({
        projectId,
        userId: req.user?.id || 'system',
        username: req.user?.username || 'User',
        userEmail: req.user?.email,
        eventType: 'member:role_change',
        action: `Changed member role to ${role}`,
        metadata: {
          targetUserId: userId,
          newRole: role,
        },
      }).catch(() => {});

      res.json({ member: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update member role' });
    }
  }

  static async removeMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const userId = String(req.params.userId);
      await ProjectMemberRepository.removeMember(projectId, userId);

      recordActivity({
        projectId,
        userId: req.user?.id || 'system',
        username: req.user?.username || 'User',
        userEmail: req.user?.email,
        eventType: 'member:leave',
        action: `Removed member from workspace`,
        metadata: {
          targetUserId: userId,
        },
      }).catch(() => {});

      res.json({ message: 'Member removed from project' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
}
