import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import url from 'url';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { ProjectRepository } from '../models/Project.js';
import { ExecutionService } from '../services/executionService.js';

export function setupTerminalWebSocket(wss: WebSocketServer): void {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    try {
      const parsedUrl = url.parse(req.url || '', true);
      const pathname = parsedUrl.pathname || '';

      if (!pathname.startsWith('/term')) {
        return;
      }

      const token = (parsedUrl.query.token as string) || '';
      const projectId = (parsedUrl.query.projectId as string) || '';

      if (!projectId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Project ID is required' }));
        ws.close(4000, 'Project ID required');
        return;
      }

      if (!token) {
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
        ws.close(4001, 'Token required');
        return;
      }

      let user: any;
      try {
        user = jwt.verify(token, config.jwtSecret);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
        ws.close(4001, 'Invalid token');
        return;
      }

      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        ws.send(JSON.stringify({ type: 'error', message: 'Project not found' }));
        ws.close(4004, 'Project not found');
        return;
      }

      const isOwner = project.ownerId === user.id;
      const membership = await ProjectMemberRepository.findMembership(projectId, user.id);

      if (!isOwner && (!membership || membership.role === 'viewer')) {
        ws.send(JSON.stringify({ type: 'error', message: 'Edit permission required to open terminal' }));
        ws.close(4003, 'Permission denied');
        return;
      }

      const sessionId = uuidv4();

      const terminal = ExecutionService.spawnTerminal(
        sessionId,
        projectId,
        (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: chunk }));
          }
        },
        (exitCode) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
            ws.close(1000, 'Process terminated');
          }
        }
      );

      ws.on('message', (message: any) => {
        try {
          const str = message.toString();
          let parsed: any;
          try {
            parsed = JSON.parse(str);
          } catch {
            // raw input
            terminal.write(str);
            return;
          }

          if (parsed.type === 'input' && typeof parsed.data === 'string') {
            terminal.write(parsed.data);
          } else if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            terminal.resize(parsed.cols, parsed.rows);
          } else if (parsed.type === 'restart') {
            terminal.restart();
          }
        } catch {
          // Do not log user inputs or secrets in application logs
        }
      });

      ws.on('close', () => {
        terminal.kill();
      });

      ws.on('error', () => {
        terminal.kill();
      });
    } catch (err) {
      console.error('[Terminal WS Error]', err);
      ws.close(4500, 'Internal server error');
    }
  });
}
