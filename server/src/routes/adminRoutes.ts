import { Router } from 'express';
import { authMiddleware, requireAdminRole } from '../middleware/auth.js';
import { AdminController } from '../controllers/adminController.js';

const router = Router();

// Protect all admin endpoints with authentication and admin-only role middleware
router.use(authMiddleware);
router.use(requireAdminRole);

// Overview
router.get('/overview', AdminController.getOverview);

// Users
router.get('/users', AdminController.getUsers);
router.patch('/users/:userId/role', AdminController.updateUserRole);
router.patch('/users/:userId/status', AdminController.updateUserStatus);

// Live Sessions
router.get('/sessions', AdminController.getLiveSessions);

// Workspaces
router.get('/workspaces', AdminController.getWorkspaces);

// Activity Timeline
router.get('/activities', AdminController.getActivities);

// Performance / Health
router.get('/performance', AdminController.getPerformance);

// Audit Logs
router.get('/audit-logs', AdminController.getAuditLogs);

export default router;

