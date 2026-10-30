import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { FileService } from '../services/fileService.js';
import { HistoryService } from '../services/historyService.js';
import { getSocketIO } from '../sockets/index.js';

export class FileController {
  static async getTree(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const files = await FileService.getProjectTree(projectId);
      res.json({ files });
    } catch (err: any) {
      console.error('[Get Tree Error]', err);
      res.status(500).json({ error: 'Failed to retrieve file tree' });
    }
  }

  static async createFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { parentId, name, content } = req.body;

      if (!name) {
        res.status(400).json({ error: 'File name is required' });
        return;
      }

      const file = await FileService.createFile(projectId, parentId || null, name, content || '');

      // Create initial version snapshot
      try {
        await HistoryService.createSnapshot(
          projectId,
          file.id,
          content || '',
          req.user || { id: 'system', username: 'Creator' },
          'Initial version',
          true
        );
      } catch (err) {
        // do not block file creation if snapshot fails
      }

      // Broadcast file tree change to room peers
      const io = getSocketIO();
      if (io) {
        io.to(`project:${projectId}`).emit('file:created', { file });
      }

      res.status(201).json({ file });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create file' });
    }
  }

  static async createFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { parentId, name } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Folder name is required' });
        return;
      }

      const folder = await FileService.createDirectory(projectId, parentId || null, name);

      const io = getSocketIO();
      if (io) {
        io.to(`project:${projectId}`).emit('file:created', { file: folder });
      }

      res.status(201).json({ folder });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create folder' });
    }
  }

  static async saveFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const fileId = String(req.params.fileId);
      const { content } = req.body;

      if (content === undefined) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      const updated = await FileService.saveFileContent(projectId, fileId, content);

      // Create debounced snapshot
      try {
        await HistoryService.createSnapshot(
          projectId,
          fileId,
          content,
          req.user || { id: 'user', username: 'Collaborator' },
          'Saved version'
        );
      } catch (err) {
        // do not block file save if snapshot fails
      }

      const io = getSocketIO();
      if (io) {
        io.to(`project:${projectId}`).emit('file:saved', { fileId, size: updated.size });
      }

      res.json({ file: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to save file' });
    }
  }

  static async renameNode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const nodeId = String(req.params.nodeId);
      const { newName } = req.body;

      if (!newName) {
        res.status(400).json({ error: 'New name is required' });
        return;
      }

      const updated = await FileService.renameNode(projectId, nodeId, newName);

      const io = getSocketIO();
      if (io) {
        io.to(`project:${projectId}`).emit('file:renamed', { file: updated });
      }

      res.json({ node: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to rename node' });
    }
  }

  static async deleteNode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const nodeId = String(req.params.nodeId);
      await FileService.deleteNode(projectId, nodeId);

      const io = getSocketIO();
      if (io) {
        io.to(`project:${projectId}`).emit('file:deleted', { fileId: nodeId });
      }

      res.json({ success: true, message: 'Node deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete node' });
    }
  }

  static async duplicateNode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const nodeId = String(req.params.nodeId);
      const duplicated = await FileService.duplicateNode(projectId, nodeId);

      const io = getSocketIO();
      if (io) {
        io.to(`project:${projectId}`).emit('file:created', { file: duplicated });
      }

      res.status(201).json({ file: duplicated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to duplicate file' });
    }
  }

  static async search(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { q, matchCase, wholeWord, isRegex, limit } = req.query;

      if (!q || typeof q !== 'string' || !q.trim()) {
        res.json({ results: [], totalMatches: 0, hasMore: false });
        return;
      }

      const maxLimit = limit ? Math.min(Math.max(1, Number(limit)), 500) : 200;
      const results = await FileService.searchAcrossFiles(projectId, q.trim(), {
        matchCase: matchCase === 'true',
        wholeWord: wholeWord === 'true',
        isRegex: isRegex === 'true',
        limit: maxLimit,
      });

      res.json({
        results,
        totalMatches: results.length,
        hasMore: results.length >= maxLimit,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Search failed' });
    }
  }
}
