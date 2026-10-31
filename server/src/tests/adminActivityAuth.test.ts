import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase } from '../db/connection.js';
import { config } from '../config/index.js';
import apiRouter from '../routes/index.js';
import { UserRepository, IUser } from '../models/User.js';
import { ProjectRepository, IProject } from '../models/Project.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { ActivityRepository } from '../models/Activity.js';
import { AuditLogRepository } from '../models/AuditLog.js';
import { HealthMetricsService } from '../services/healthMetricsService.js';
import {
  isSensitiveFilename,
  sanitizePath,
  sanitizeMetadata,
  recordActivity,
} from '../services/activitySanitizer.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${detail}`);
    failed++;
  }
}

async function runAuthTestSuite() {
  console.log('\n=======================================================');
  console.log('🛡️  Running Admin & Activity Authorization Test Suite');
  console.log('=======================================================\n');

  await initDatabase();

  // Create an in-test express server
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api`;

  function createToken(user: { id: string; email: string; username: string; role?: string }) {
    return jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role || 'user' },
      config.jwtSecret,
      { expiresIn: '1d' }
    );
  }

  const timestamp = Date.now();
  const passwordHash = await bcrypt.hash('pass123', 8);

  // 1. Create Admin User
  const adminUser: IUser = {
    id: `admin-${timestamp}`,
    email: `admin_${timestamp}@nexus.local`,
    username: 'PlatformAdmin',
    passwordHash,
    avatarColor: '#ef4444',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await UserRepository.create(adminUser);

  // 2. Create Regular Member User
  const memberUser: IUser = {
    id: `member-${timestamp}`,
    email: `member_${timestamp}@nexus.local`,
    username: 'WorkspaceMember',
    passwordHash,
    avatarColor: '#3b82f6',
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await UserRepository.create(memberUser);

  // 3. Create Non-Member User
  const nonMemberUser: IUser = {
    id: `nonmember-${timestamp}`,
    email: `nonmember_${timestamp}@nexus.local`,
    username: 'UnrelatedUser',
    passwordHash,
    avatarColor: '#10b981',
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await UserRepository.create(nonMemberUser);

  // 4. Create Suspended User
  const suspendedUser: IUser = {
    id: `suspended-${timestamp}`,
    email: `suspended_${timestamp}@nexus.local`,
    username: 'SuspendedUser',
    passwordHash,
    avatarColor: '#6b7280',
    role: 'user',
    status: 'suspended',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await UserRepository.create(suspendedUser);

  // 5. Create Private Workspace owned by Member User
  const privateWorkspace: IProject = {
    id: `ws-private-${timestamp}`,
    name: 'Confidential Internal App',
    description: 'Workspace with sensitive files',
    ownerId: memberUser.id,
    template: 'react',
    isPublic: false,
    rootPath: `data/projects/ws-private-${timestamp}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ProjectRepository.create(privateWorkspace);

  // Add owner to members table
  await ProjectMemberRepository.addMember({
    id: uuidv4(),
    projectId: privateWorkspace.id,
    userId: memberUser.id,
    role: 'owner',
    joinedAt: new Date().toISOString(),
  });

  const adminToken = createToken(adminUser);
  const memberToken = createToken(memberUser);
  const nonMemberToken = createToken(nonMemberUser);
  const suspendedToken = createToken(suspendedUser);

  console.log('📦 1. Testing Unauthenticated Request Rejection...');
  try {
    const res = await fetch(`${baseUrl}/admin/overview`);
    assert(res.status === 401, 'Unauthenticated request to /api/admin/overview returns 401 Unauthorized');
  } catch (err: any) {
    assert(false, 'Unauthenticated check failed', err.message);
  }

  console.log('\n📦 2. Testing Non-Admin Authorization Guard (403 Forbidden)...');
  try {
    const resOverview = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(resOverview.status === 403, 'Non-admin user calling /api/admin/overview returns 403 Forbidden');

    const resUsers = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(resUsers.status === 403, 'Non-admin user calling /api/admin/users returns 403 Forbidden');

    const resRole = await fetch(`${baseUrl}/admin/users/${nonMemberUser.id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });
    assert(resRole.status === 403, 'Non-admin user calling /api/admin/users/:id/role returns 403 Forbidden');

    const resPerf = await fetch(`${baseUrl}/admin/performance`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(resPerf.status === 403, 'Non-admin user calling /api/admin/performance returns 403 Forbidden');

    const resAudit = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert(resAudit.status === 403, 'Non-admin user calling /api/admin/audit-logs returns 403 Forbidden');
  } catch (err: any) {
    assert(false, 'Non-admin authorization guards failed', err.message);
  }

  console.log('\n📦 3. Testing Admin Privileged Access (200 OK)...');
  try {
    const resOverview = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const overviewData: any = await resOverview.json();
    assert(resOverview.status === 200, 'Admin calling /api/admin/overview returns 200 OK');
    assert(overviewData.overview !== undefined, 'Admin overview contains overview payload');
    assert(typeof overviewData.overview.registeredUsers === 'number', 'Admin overview returns registered users count');
    assert(typeof overviewData.overview.healthCounts === 'object', 'Admin overview returns health counts');

    const resUsers = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersData: any = await resUsers.json();
    assert(resUsers.status === 200, 'Admin calling /api/admin/users returns 200 OK');
    assert(Array.isArray(usersData.users), 'Admin users response contains users array');
    assert(usersData.users.some((u: any) => u.id === memberUser.id), 'Admin users list contains registered user');

    const resWorkspaces = await fetch(`${baseUrl}/admin/workspaces`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const wsData: any = await resWorkspaces.json();
    assert(resWorkspaces.status === 200, 'Admin calling /api/admin/workspaces returns 200 OK');
    assert(wsData.workspaces.some((w: any) => w.id === privateWorkspace.id), 'Admin workspaces list contains workspace');

    const resPerf = await fetch(`${baseUrl}/admin/performance`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const perfData: any = await resPerf.json();
    assert(resPerf.status === 200, 'Admin calling /api/admin/performance returns 200 OK');
    assert(perfData.executions !== undefined && perfData.errors !== undefined, 'Performance payload contains execution and error metrics');

    const resSessions = await fetch(`${baseUrl}/admin/sessions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resSessions.status === 200, 'Admin calling /api/admin/sessions returns 200 OK');
  } catch (err: any) {
    assert(false, 'Admin privileged access tests failed', err.message);
  }

  console.log('\n📦 4. Testing Admin Action Audit Logging (Actor, Action, Target, Timestamp)...');
  try {
    // Admin updates nonMemberUser status to suspended
    const resStatus = await fetch(`${baseUrl}/admin/users/${nonMemberUser.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert(resStatus.status === 200, 'Admin updates user status to suspended');

    // Admin updates memberUser role to admin
    const resRole = await fetch(`${baseUrl}/admin/users/${memberUser.id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });
    assert(resRole.status === 200, 'Admin updates user role to admin');

    // Verify Audit Logs
    const resAudit = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditData: any = await resAudit.json();
    assert(resAudit.status === 200, 'Retrieve audit logs returns 200 OK');

    const statusLog = auditData.auditLogs.find(
      (l: any) => l.action === 'user:change_status' && l.targetId === nonMemberUser.id
    );
    assert(statusLog !== undefined, 'Audit log records status change action');
    assert(statusLog?.actorId === adminUser.id, 'Audit log records correct actor ID');
    assert(statusLog?.actorUsername === adminUser.username, 'Audit log records correct actor username');
    assert(statusLog?.targetType === 'user', 'Audit log records correct target type');
    assert(typeof statusLog?.timestamp === 'string', 'Audit log records timestamp');

    const roleLog = auditData.auditLogs.find(
      (l: any) => l.action === 'user:change_role' && l.targetId === memberUser.id
    );
    assert(roleLog !== undefined, 'Audit log records role change action');
  } catch (err: any) {
    assert(false, 'Audit logging tests failed', err.message);
  }

  console.log('\n📦 5. Testing Suspended User Access Rejection...');
  try {
    const res = await fetch(`${baseUrl}/projects`, {
      headers: { Authorization: `Bearer ${suspendedToken}` },
    });
    assert(res.status === 403, 'Suspended user request is rejected with 403 Forbidden');
  } catch (err: any) {
    assert(false, 'Suspended user test failed', err.message);
  }

  console.log('\n📦 6. Testing Workspace Member vs Non-Member Activity Isolation...');
  try {
    // Record an activity inside privateWorkspace
    await recordActivity({
      projectId: privateWorkspace.id,
      userId: memberUser.id,
      username: memberUser.username,
      userEmail: memberUser.email,
      eventType: 'file:save',
      action: 'Saved file src/App.tsx',
      metadata: {
        fileName: 'App.tsx',
        filePath: 'src/App.tsx',
        fileSize: 1024,
      },
    });

    // 1. Authorized member access
    const resMember = await fetch(`${baseUrl}/projects/${privateWorkspace.id}/activities`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    const memberData: any = await resMember.json();
    assert(resMember.status === 200, 'Authorized workspace member can view workspace activities');
    assert(
      Array.isArray(memberData.activities) && memberData.activities.length >= 1,
      'Member receives activity list for their workspace'
    );
    assert(
      memberData.activities.every((a: any) => a.projectId === privateWorkspace.id),
      'Activities returned are strictly scoped to the requested workspace'
    );

    // 2. Unauthorized non-member access to private workspace
    const resNonMember = await fetch(`${baseUrl}/projects/${privateWorkspace.id}/activities`, {
      headers: { Authorization: `Bearer ${nonMemberToken}` },
    });
    assert(
      resNonMember.status === 403,
      'Unauthorized non-member attempting to view private workspace activities receives 403 Forbidden'
    );
  } catch (err: any) {
    assert(false, 'Workspace activity isolation test failed', err.message);
  }

  console.log('\n📦 7. Testing Allow-Listed Event Types & Metadata Sanitization...');
  try {
    // Sensitive file detection
    assert(isSensitiveFilename('.env'), 'Identifies .env as sensitive filename');
    assert(isSensitiveFilename('.env.production'), 'Identifies .env.production as sensitive filename');
    assert(isSensitiveFilename('id_rsa'), 'Identifies id_rsa as sensitive filename');
    assert(isSensitiveFilename('aws_secret_key.pem'), 'Identifies .pem key as sensitive filename');
    assert(!isSensitiveFilename('index.ts'), 'Allows regular index.ts filename');

    // Path sanitization
    assert(
      sanitizePath('config/.env') === '[REDACTED_CONFIG_FILE]',
      'Sanitizes .env path to [REDACTED_CONFIG_FILE]'
    );
    assert(
      sanitizePath('src/components/Header.tsx') === 'src/components/Header.tsx',
      'Preserves safe file paths'
    );

    // Metadata stripping
    const unsafeMeta = {
      fileName: '.env.local',
      filePath: 'project/.env.local',
      content: 'SECRET_API_KEY=1234567890abcdef',
      password: 'mypassword123',
      token: 'jwt-token-value',
      terminalOutput: 'root@nexus: bash execution content...',
      keystroke: 'Ctrl+C',
      fileSize: 42,
      durationMs: 120,
    };

    const cleanedMeta = sanitizeMetadata(unsafeMeta);
    assert(cleanedMeta.content === undefined, 'Strips raw source code / content from metadata');
    assert(cleanedMeta.password === undefined, 'Strips passwords from metadata');
    assert(cleanedMeta.token === undefined, 'Strips tokens from metadata');
    assert(cleanedMeta.terminalOutput === undefined, 'Strips full terminal contents from metadata');
    assert(cleanedMeta.keystroke === undefined, 'Strips keystrokes from metadata');
    assert(cleanedMeta.fileName === '[REDACTED_CONFIG_FILE]', 'Masks sensitive filename');
    assert(cleanedMeta.filePath === '[REDACTED_CONFIG_FILE]', 'Masks sensitive filepath');
    assert(cleanedMeta.fileSize === 42, 'Preserves safe allowed numerical metadata');

    // Non-allow-listed event rejection
    const invalidEventResult = await recordActivity({
      userId: memberUser.id,
      username: memberUser.username,
      eventType: 'malicious:hack' as any,
      action: 'Unauthorized test event',
    });
    assert(invalidEventResult === null, 'Rejects non-allow-listed event types');
  } catch (err: any) {
    assert(false, 'Sanitization tests failed', err.message);
  }

  console.log('\n📦 8. Testing Health and Performance Tracking (Real Counters)...');
  try {
    HealthMetricsService.recordExecution({ success: true, durationMs: 150 });
    HealthMetricsService.recordExecution({ success: false, durationMs: 80 });
    HealthMetricsService.recordExecution({ success: false, durationMs: 5000, timedOut: true });
    HealthMetricsService.recordSaveFailure();
    HealthMetricsService.recordApiError();

    const metrics = await HealthMetricsService.getMetrics();
    assert(metrics.executions.total >= 3, 'Execution counters track real executions');
    assert(metrics.executions.successful >= 1, 'Tracks successful executions count');
    assert(metrics.executions.failed >= 2, 'Tracks failed executions count');
    assert(metrics.executions.timeoutCount >= 1, 'Tracks timeout count');
    assert(metrics.errors.saveFailures >= 1, 'Tracks save failures count');
    assert(metrics.errors.apiErrors >= 1, 'Tracks API errors count');
    assert(typeof metrics.system.uptimeSeconds === 'number', 'Tracks system uptime');
  } catch (err: any) {
    assert(false, 'Health and performance tracking test failed', err.message);
  }

  server.close();

  console.log('\n=======================================================');
  console.log(`📊 Auth & Activity Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAuthTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

