import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { UserRepository, IUser } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'
];

export class AuthController {
  static async signup(req: Request, res: Response): Promise<void> {
    try {
      const { email, username, password } = req.body;

      if (!email || !username || !password) {
        res.status(400).json({ error: 'Email, username, and password are required' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long' });
        return;
      }

      const existing = await UserRepository.findByEmail(email.toLowerCase().trim());
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      const user: IUser = {
        id: uuidv4(),
        email: email.toLowerCase().trim(),
        username: username.trim(),
        passwordHash,
        avatarColor: randomColor,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const createdUser = await UserRepository.create(user);

      const token = jwt.sign(
        { id: createdUser.id, email: createdUser.email, username: createdUser.username, role: createdUser.role },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        user: {
          id: createdUser.id,
          email: createdUser.email,
          username: createdUser.username,
          avatarColor: createdUser.avatarColor,
          role: createdUser.role,
          status: createdUser.status,
          lastActive: createdUser.lastActive,
        },
        token,
      });
    } catch (err: any) {
      console.error('[Auth Signup Error]', err);
      res.status(500).json({ error: 'Internal server error during signup' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const user = await UserRepository.findByEmail(email.toLowerCase().trim());
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      if (user.status === 'suspended') {
        res.status(403).json({ error: 'Account suspended. Contact administrator.' });
        return;
      }

      await UserRepository.updateLastActive(user.id);

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username, role: user.role },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarColor: user.avatarColor,
          role: user.role,
          status: user.status,
          lastActive: user.lastActive,
        },
        token,
      });
    } catch (err: any) {
      console.error('[Auth Login Error]', err);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  }

  static async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const user = await UserRepository.findById(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarColor: user.avatarColor,
          role: user.role,
          status: user.status,
          lastActive: user.lastActive,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve profile' });
    }
  }

  static async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  }

  static async guest(_req: Request, res: Response): Promise<void> {
    try {
      const guestNum = Math.floor(1000 + Math.random() * 9000);
      const username = `Dev_${guestNum}`;
      const email = `guest_${uuidv4().substring(0, 8)}@nexus.local`;
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      const user: IUser = {
        id: uuidv4(),
        email,
        username,
        passwordHash: 'guest_no_direct_password_login',
        avatarColor: randomColor,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const createdUser = await UserRepository.create(user);

      const token = jwt.sign(
        { id: createdUser.id, email: createdUser.email, username: createdUser.username, role: createdUser.role },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        user: {
          id: createdUser.id,
          email: createdUser.email,
          username: createdUser.username,
          avatarColor: createdUser.avatarColor,
          role: createdUser.role,
          status: createdUser.status,
          lastActive: createdUser.lastActive,
        },
        token,
      });
    } catch (err: any) {
      console.error('[Auth Guest Error]', err);
      res.status(500).json({ error: 'Failed to create guest session' });
    }
  }
}
