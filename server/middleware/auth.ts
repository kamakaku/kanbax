import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Typen für Request mit User
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: number;
    }
  }
}

// Authentifizierung prüfen
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Prüfe ob User in Session existiert
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Nicht authentifiziert' });
    }

    // Hole User aus Datenbank
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      return res.status(401).json({ message: 'Benutzer nicht gefunden' });
    }

    // Füge User und userId zum Request hinzu
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Interner Server-Fehler' });
  }
};

// Optional Auth - User ID wird gesetzt falls vorhanden
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
