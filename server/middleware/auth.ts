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

// Extend Request type to include user and userId
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: number;
    }
  }
}

// Authentication check
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user exists in session
    if (!req.session || !req.session.userId) {
      console.log(`[AUTH] Unauthentifizierter Zugriff auf ${req.method} ${req.path}`);
      return res.status(401).json({ message: 'Nicht authentifiziert' });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      console.log(`[AUTH] Benutzer mit ID ${req.session.userId} nicht gefunden`);
      return res.status(401).json({ message: 'Benutzer nicht gefunden' });
    }

    // Add user and userId to request
    req.user = user;
    req.userId = user.id;
    
    console.log(`[AUTH] Authentifizierter Zugriff: Benutzer ${user.username} (ID: ${user.id}) auf ${req.method} ${req.path}`);

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
        console.log(`[AUTH-OPTIONAL] Authentifizierter Benutzer ${user.username} (ID: ${user.id}) auf ${req.method} ${req.path}`);
      } else {
        console.log(`[AUTH-OPTIONAL] Ungültige Benutzer-ID in Session: ${req.session.userId}`);
      }
    } else {
      console.log(`[AUTH-OPTIONAL] Keine Benutzer-Session für ${req.method} ${req.path}`);
    }
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};