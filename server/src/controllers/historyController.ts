import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { HistoryService } from '../services/historyService.js';
import { FileNodeRepository } from '../models/FileNode.js';

export class HistoryController {
  static async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const fileId = String(req.params.fileId);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
      const skip = Math.max(0, parseInt(req.query.skip as string, 10) || 0);

      const result = await HistoryService.getHistory(projectId, fileId, limit, skip);
      res.json(result);
    } catch (err: any) {
      res.status(err.message === 'File not found' ? 404 : 500).json({
        error: err.message || 'Failed to retrieve file history',
      });
    }
  }

  static async getVersion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const fileId = String(req.params.fileId);
      const versionId = String(req.params.versionId);

      const version = await HistoryService.getVersion(projectId, fileId, versionId);
      res.json({ version });
    } catch (err: any) {
      res.status(err.message.includes('not found') ? 404 : 500).json({
        error: err.message || 'Failed to retrieve version',
      });
    }
  }

  static async getDiff(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const fileId = String(req.params.fileId);
      const v1 = String(req.query.v1 || '');
      const v2 = String(req.query.v2 || '');

      const file = await FileNodeRepository.findById(fileId);
      if (!file || file.projectId !== projectId) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      let content1 = '';
      let info1: { label: string; versionNumber?: number; createdAt?: string } = { label: 'Original' };

      if (v1 === 'current' || !v1) {
        content1 = file.content || '';
        info1 = { label: 'Current File', createdAt: file.updatedAt };
      } else {
        const ver1 = await HistoryService.getVersion(projectId, fileId, v1);
        content1 = ver1.content;
        info1 = { label: `Version ${ver1.versionNumber}`, versionNumber: ver1.versionNumber, createdAt: ver1.createdAt };
      }

      let content2 = '';
      let info2: { label: string; versionNumber?: number; createdAt?: string } = { label: 'Modified' };

      if (v2 === 'current') {
        content2 = file.content || '';
        info2 = { label: 'Current File', createdAt: file.updatedAt };
      } else if (v2) {
        const ver2 = await HistoryService.getVersion(projectId, fileId, v2);
        content2 = ver2.content;
        info2 = { label: `Version ${ver2.versionNumber}`, versionNumber: ver2.versionNumber, createdAt: ver2.createdAt };
      } else {
        content2 = file.content || '';
        info2 = { label: 'Current File', createdAt: file.updatedAt };
      }

      const diff = HistoryService.computeDiff(content1, content2);
      res.json({ v1: info1, v2: info2, diff, originalContent: content1, modifiedContent: content2 });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to compute diff' });
    }
  }

  static async createSnapshot(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const fileId = String(req.params.fileId);
      const { content, summary } = req.body;

      const file = await FileNodeRepository.findById(fileId);
      if (!file || file.projectId !== projectId) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const snapshotContent = content !== undefined ? content : (file.content || '');
      const user = req.user || { id: 'anonymous', username: 'User' };

      const version = await HistoryService.createSnapshot(
        projectId,
        fileId,
        snapshotContent,
        user,
        summary || 'Manual checkpoint',
        true
      );

      res.status(201).json({ version });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create snapshot' });
    }
  }

  static async restoreVersion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const fileId = String(req.params.fileId);
      const versionId = String(req.params.versionId);
      const user = req.user || { id: 'anonymous', username: 'User' };

      const result = await HistoryService.restoreVersion(projectId, fileId, versionId, user);
      res.json({
        message: 'File restored successfully',
        file: result.file,
        newVersion: result.newVersion,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to restore version' });
    }
  }
}
