import { Router } from 'express';
import authRoutes from './authRoutes.js';
import projectRoutes from './projectRoutes.js';
import fileRoutes from './fileRoutes.js';
import collaborationRoutes from './collaborationRoutes.js';
import gitRoutes from './gitRoutes.js';
import executionRoutes from './executionRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/projects', fileRoutes);
router.use('/projects', collaborationRoutes);
router.use('/projects', gitRoutes);
router.use('/projects', executionRoutes);

export default router;
