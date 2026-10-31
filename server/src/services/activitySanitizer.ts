import { v4 as uuidv4 } from 'uuid';
import { ActivityRepository, ActivityEventType, IActivity, IActivityMetadata } from '../models/Activity.js';
import { AuditLogRepository, IAuditLog } from '../models/AuditLog.js';

export const ALLOWED_EVENT_TYPES: Set<ActivityEventType> = new Set([
  'project:create',
  'project:update',
  'project:delete',
  'file:create',
  'file:save',
  'file:rename',
  'file:delete',
  'execution:start',
  'execution:complete',
  'execution:error',
  'git:commit',
  'git:stage',
  'member:join',
  'member:leave',
  'member:role_change',
  'session:connect',
  'session:disconnect',
  'admin:user_update',
  'admin:role_change',
  'admin:status_change',
  'admin:project_modify',
  'error:api',
  'error:save',
  'error:websocket',
]);

const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.pem$/i,
  /\.key$/i,
  /secret/i,
  /token/i,
  /credential/i,
  /password/i,
];

const FORBIDDEN_META_KEYS = new Set([
  'content',
  'code',
  'sourcecode',
  'source_code',
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'env',
  'environment',
  'terminal',
  'terminalOutput',
  'terminal_output',
  'keystroke',
  'keystrokes',
  'stdin',
  'rawOutput',
]);

export function isSensitiveFilename(filename: string): boolean {
  if (!filename) return false;
  const basename = filename.split(/[/\\]/).pop() || filename;
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}

export function sanitizePath(filePath: string): string {
  if (!filePath) return '';
  const parts = filePath.split(/[/\\]/);
  const basename = parts[parts.length - 1];
  if (isSensitiveFilename(basename)) {
    return '[REDACTED_CONFIG_FILE]';
  }
  return filePath;
}

export function sanitizeMetadata(metadata: Record<string, any> = {}): IActivityMetadata {
  const sanitized: IActivityMetadata = {};

  for (const [key, val] of Object.entries(metadata)) {
    // Strip strictly forbidden keys (code, passwords, tokens, env, keystrokes, terminal)
    if (FORBIDDEN_META_KEYS.has(key)) {
      continue;
    }

    if (key === 'fileName') {
      sanitized.fileName = isSensitiveFilename(String(val)) ? '[REDACTED_CONFIG_FILE]' : String(val);
    } else if (key === 'filePath') {
      sanitized.filePath = sanitizePath(String(val));
    } else if (typeof val === 'string' && (val.length > 300 || val.includes('\n'))) {
      // Avoid raw large text dumps or source code exposures
      sanitized[key] = val.substring(0, 150) + '... [truncated]';
    } else if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export interface RecordActivityInput {
  projectId?: string;
  userId: string;
  username: string;
  userEmail?: string;
  eventType: ActivityEventType;
  action: string;
  metadata?: Record<string, any>;
}

export async function recordActivity(input: RecordActivityInput): Promise<IActivity | null> {
  try {
    if (!ALLOWED_EVENT_TYPES.has(input.eventType)) {
      console.warn(`[Activity] Rejected non-allow-listed event type: ${input.eventType}`);
      return null;
    }

    const activity: IActivity = {
      id: uuidv4(),
      projectId: input.projectId,
      userId: input.userId,
      username: input.username,
      userEmail: input.userEmail,
      eventType: input.eventType,
      action: input.action,
      metadata: sanitizeMetadata(input.metadata || {}),
      createdAt: new Date().toISOString(),
    };

    return await ActivityRepository.create(activity);
  } catch (err: any) {
    console.error('[Activity] Failed to record activity:', err.message);
    return null;
  }
}

export interface RecordAuditLogInput {
  actorId: string;
  actorUsername: string;
  actorEmail?: string;
  action: string;
  targetType: 'user' | 'project' | 'member' | 'system';
  targetId: string;
  targetName?: string;
  details?: Record<string, any>;
}

export async function recordAuditLog(input: RecordAuditLogInput): Promise<IAuditLog | null> {
  try {
    const log: IAuditLog = {
      id: uuidv4(),
      actorId: input.actorId,
      actorUsername: input.actorUsername,
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetName: input.targetName,
      details: sanitizeMetadata(input.details || {}),
      timestamp: new Date().toISOString(),
    };

    return await AuditLogRepository.create(log);
  } catch (err: any) {
    console.error('[AuditLog] Failed to record audit log:', err.message);
    return null;
  }
}

