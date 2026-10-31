import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ExecutionService } from '../services/executionService.js';
import { HealthMetricsService } from '../services/healthMetricsService.js';
import { recordActivity } from '../services/activitySanitizer.js';

export class ExecutionController {
  static async runFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const fileId = String(req.params.fileId);
      const { content } = req.body || {};

      const result = await ExecutionService.runFile(projectId, fileId, content);

      // Record performance counters (exitCode === 0 means success)
      const isSuccess = result.exitCode === 0;
      HealthMetricsService.recordExecution({
        success: isSuccess,
        durationMs: result.durationMs,
        timedOut: result.timedOut,
      });

      // Record sanitized execution activity (never storing raw terminal buffers or code)
      recordActivity({
        projectId,
        userId: req.user?.id || 'system',
        username: req.user?.username || 'User',
        userEmail: req.user?.email,
        eventType: result.timedOut || !isSuccess ? 'execution:error' : 'execution:complete',
        action: `Executed file in ${result.durationMs}ms (${isSuccess ? 'success' : 'exit code ' + result.exitCode})`,
        metadata: {
          fileId,
          durationMs: result.durationMs,
          exitCode: result.exitCode ?? -1,
          timeout: result.timedOut,
          success: isSuccess,
        },
      }).catch(() => {});

      res.json(result);
    } catch (err: any) {
      console.error('[Run File Error]', err);

      HealthMetricsService.recordExecution({
        success: false,
        durationMs: 0,
      });

      recordActivity({
        projectId: String(req.params.projectId),
        userId: req.user?.id || 'system',
        username: req.user?.username || 'User',
        userEmail: req.user?.email,
        eventType: 'execution:error',
        action: `Execution error: ${err.message}`,
        metadata: {
          fileId: String(req.params.fileId),
          errorSummary: err.message,
          success: false,
        },
      }).catch(() => {});

      res.status(400).json({ error: err.message || 'Execution failed' });
    }
  }

  static async runEntryFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const { content } = req.body || {};

      const result = await ExecutionService.runEntryFile(projectId, content);

      const isSuccess = result.exitCode === 0;
      HealthMetricsService.recordExecution({
        success: isSuccess,
        durationMs: result.durationMs,
        timedOut: result.timedOut,
      });

      recordActivity({
        projectId,
        userId: req.user?.id || 'system',
        username: req.user?.username || 'User',
        userEmail: req.user?.email,
        eventType: result.timedOut || !isSuccess ? 'execution:error' : 'execution:complete',
        action: `Executed project entry target in ${result.durationMs}ms (${isSuccess ? 'success' : 'exit code ' + result.exitCode})`,
        metadata: {
          command: result.command,
          durationMs: result.durationMs,
          exitCode: result.exitCode ?? -1,
          timeout: result.timedOut,
          success: isSuccess,
        },
      }).catch(() => {});

      res.json(result);
    } catch (err: any) {
      console.error('[Run Entry Error]', err);

      HealthMetricsService.recordExecution({
        success: false,
        durationMs: 0,
      });

      res.status(400).json({ error: err.message || 'Failed to run entry file' });
    }
  }

  static async getRunConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      const runConfig = await ExecutionService.getRunConfig(projectId);
      res.json(runConfig);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to retrieve run configuration' });
    }
  }

  static async stopAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const projectId = String(req.params.projectId);
      ExecutionService.killAllForProject(projectId);
      res.json({ message: 'All project execution processes terminated' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to stop processes' });
    }
  }
}
