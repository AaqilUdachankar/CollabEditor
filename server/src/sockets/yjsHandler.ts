import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import * as Y from 'yjs';
import jwt from 'jsonwebtoken';
import { setupWSConnection, setPersistence } from 'y-websocket/bin/utils';
import { config } from '../config/index.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { ProjectRepository } from '../models/Project.js';
import { FileNodeRepository } from '../models/FileNode.js';
import { FileService } from '../services/fileService.js';

const yjsDataDir = path.join(process.cwd(), './data/yjs');
if (!fs.existsSync(yjsDataDir)) {
  fs.mkdirSync(yjsDataDir, { recursive: true });
}

function getDocBinaryPath(docName: string): string {
  const safe = docName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(yjsDataDir, `${safe}.bin`);
}

// Configure persistent Yjs storage
setPersistence({
  bindState: async (docName: string, ydoc: Y.Doc) => {
    const binPath = getDocBinaryPath(docName);
    if (fs.existsSync(binPath)) {
      try {
        const update = fs.readFileSync(binPath);
        Y.applyUpdate(ydoc, update);
      } catch (err) {
        console.error(`[Yjs Persistence] Error loading binary state for ${docName}:`, err);
      }
    } else {
      // If no CRDT binary exists yet, seed from FileNode repository
      const parts = docName.split('::');
      if (parts.length === 2) {
        const [projectId, fileId] = parts;
        try {
          const file = await FileNodeRepository.findById(fileId);
          if (file && file.content) {
            const ytext = ydoc.getText('monaco');
            ydoc.transact(() => {
              ytext.insert(0, file.content || '');
            });
            const state = Y.encodeStateAsUpdate(ydoc);
            fs.writeFileSync(binPath, Buffer.from(state));
          }
        } catch (err) {
          console.error(`[Yjs Persistence] Error seeding initial content for ${docName}:`, err);
        }
      }
    }
  },
  writeState: async (docName: string, ydoc: Y.Doc) => {
    try {
      const binPath = getDocBinaryPath(docName);
      const state = Y.encodeStateAsUpdate(ydoc);
      fs.writeFileSync(binPath, Buffer.from(state));

      // Synchronize plain text content back to disk workspace & DB
      const parts = docName.split('::');
      if (parts.length === 2) {
        const [projectId, fileId] = parts;
        const text = ydoc.getText('monaco').toString();
        await FileService.saveFileContent(projectId, fileId, text);
      }
    } catch (err) {
      console.error(`[Yjs Persistence] Error saving state for ${docName}:`, err);
    }
  }
});

export function setupYjsWebSocket(wss: WebSocketServer): void {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      const parsedUrl = url.parse(req.url || '', true);
      const pathname = parsedUrl.pathname || '';

      if (!pathname.startsWith('/yjs')) {
        return;
      }

      const token = (parsedUrl.query.token as string) || '';
      const docName = (parsedUrl.query.room as string) || pathname.replace(/^\/yjs\/?/, '');

      if (!docName) {
        ws.close(4000, 'Document room name required');
        return;
      }

      // Verify token
      let user: { id: string; email: string; username: string } | null = null;
      if (token) {
        try {
          user = jwt.verify(token, config.jwtSecret) as any;
        } catch {
          ws.close(4001, 'Invalid authentication token');
          return;
        }
      }

      // Validate project access if docName follows projectId::fileId format
      const parts = docName.split('::');
      if (parts.length >= 1) {
        const projectId = parts[0];
        const project = await ProjectRepository.findById(projectId);
        if (project && !project.isPublic) {
          if (!user) {
            ws.close(4001, 'Authentication required for private project');
            return;
          }
          const isOwner = project.ownerId === user.id;
          const member = await ProjectMemberRepository.findMembership(projectId, user.id);
          if (!isOwner && !member) {
            ws.close(4003, 'Unauthorized access to project document');
            return;
          }
        }
      }

      // Hand over connection to Yjs sync protocol provider
      setupWSConnection(ws, req, { docName });
    } catch (err) {
      console.error('[Yjs WebSocket Connection Error]', err);
      ws.close(4500, 'Internal server error');
    }
  });
}
