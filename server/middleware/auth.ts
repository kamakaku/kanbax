import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Types for Request with User
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// Authentication check
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user exists in session
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Nicht authentifiziert' });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      return res.status(401).json({ message: 'Benutzer nicht gefunden' });
    }

    // Add user and userId to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Interner Server-Fehler' });
  }
};

// Optional Auth - User ID is set if available
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.session && req.session.userId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId));

      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    }
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};