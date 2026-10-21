import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ProjectRepository } from '../models/Project.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { ProjectService } from '../services/projectService.js';
import { FileNodeRepository } from '../models/FileNode.js';
import { ExecutionService } from '../services/executionService.js';
import fs from 'fs';

export class ProjectController {
  static async getProjects(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const memberships = await ProjectMemberRepository.findByUser(userId);
      const projectIds = memberships.map(m => m.projectId);

      const projects = await ProjectRepository.findUserProjects(userId, projectIds);

      // Attach member role to each project
      const enriched = projects.map(p => {
        const mem = memberships.find(m => m.projectId === p.id);
        const role = p.ownerId === userId ? 'owner' : (mem?.role || 'viewer');
        return { ...p, role };
      });

      res.json({ projects: enriched });
    } catch (err: any) {
      console.error('[Get Projects Error]', err);
      res.status(500).json({ error: 'Failed to retrieve projects' });
    }
  }

  static async getProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const role = req.projectMemberRole || (project.ownerId === req.user?.id ? 'owner' : 'viewer');
      res.json({ project: { ...project, role } });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve project details' });
    }
  }

  static async createProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, description, template, isPublic } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ error: 'Project name is required' });
        return;
      }

      const project = await ProjectService.createProject(
        userId,
        name.trim(),
        description || '',
        template || 'vanilla',
        Boolean(isPublic)
      );

      res.status(201).json({ project: { ...project, role: 'owner' } });
    } catch (err: any) {
      console.error('[Create Project Error]', err);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }

  static async updateProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { name, description, isPublic } = req.body;

      const updated = await ProjectRepository.update(projectId, {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
      });

      if (!updated) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.json({ project: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update project' });
    }
  }

  static async deleteProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);

      // 1. Terminate all active processes
      ExecutionService.killAllForProject(projectId);

      // 2. Remove files from DB
      await FileNodeRepository.deleteByProject(projectId);

      // 3. Remove disk directory
      const projectDir = ProjectService.getProjectPath(projectId);
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }

      // 4. Remove project record
      await ProjectRepository.delete(projectId);

      res.json({ message: 'Project successfully deleted' });
    } catch (err: any) {
      console.error('[Delete Project Error]', err);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }

  static async exportProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      res.attachment(`${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`);
      await ProjectService.exportProjectZip(projectId, res);
    } catch (err: any) {
      console.error('[Export Project Error]', err);
      res.status(500).json({ error: 'Failed to export project archive' });
    }
  }
}
