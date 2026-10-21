import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/guest', AuthController.guest);
router.get('/me', authMiddleware, AuthController.me);
router.post('/logout', AuthController.logout);

export default router;
