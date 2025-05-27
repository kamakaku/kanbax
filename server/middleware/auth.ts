import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { permissionService } from '../permissions';

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
    
    // Prüfen, ob der Benutzer pausiert ist
    if (user.isPaused === true) {
      console.log(`[AUTH] Zugriff verweigert: Benutzer ${user.username} (ID: ${user.id}) ist pausiert`);
      return res.status(403).json({ 
        message: 'Ihr Konto wurde pausiert', 
        reason: user.pauseReason || 'Kein Grund angegeben',
        isPaused: true
      });
    }

    // Add user and userId to request
    req.user = user;
    req.userId = user.id;
    
    // Grundsätzliche Authentifizierungs-Logmeldung
    console.log(`[AUTH] Authentifizierter Zugriff: Benutzer ${user.username} (ID: ${user.id}) auf ${req.method} ${req.path}`);

    // Ausnahmen für immer erlaubte Pfade (Dashboard, Abonnement usw.)
    const alwaysAllowedPaths = [
      '/api/user-profile',    // Eigenes Profil
      '/api/auth/logout',     // Abmelden
      '/api/dashboard',       // Dashboard
      '/api/subscription',    // Abonnement-Verwaltung
      '/api/subscription/update-user', // Benutzer-Abonnement-Update (neuer Endpunkt)
      '/api/subscription-plans', // Abonnement-Pläne
      '/api/auth/check',      // Auth-Check
      '/api/notifications',   // Benachrichtigungen
      '/api/user-tasks',      // Persönliche Aufgaben
      '/api/all-tasks',       // Aufgabenliste für Dashboard
      '/api/projects',        // Projekte für Dashboard
      '/api/key-results',     // Key Results für Dashboard
      '/api/objectives',      // Objectives für Dashboard
      '/api/activity',        // Aktivitäten für Dashboard
      '/api/productivity/metrics', // Produktivitätsmetriken für Dashboard
      '/api/user'            // Benutzerinformationen
    ];
    
    // Spezielle Pfade, die für Benutzer, die auf Aktivierung warten, zugelassen sind
    // Egal, was sonst in alwaysAllowedPaths steht
    const activationPendingPaths = [
      '/api/user-profile',
      '/api/auth/logout',
      '/api/auth/check',
      '/api/subscription',
      '/api/subscription/update-user', // Benutzer-Abonnement-Update
      '/api/subscription-plans',
      '/api/notifications',
      '/api/dashboard',
      '/api/user' // Notwendig für Benutzerinformationen
    ];
    
    // Prüfen auf Pfadpräfixe für spezielle Routen wie Zahlungsverarbeitung
    const isPaymentPath = req.path.startsWith('/api/payment') || 
                         req.path.startsWith('/api/stripe');
    
    // Wenn es sich um einen erlaubten Pfad oder Zahlungspfad handelt, lassen wir immer durch
    // Überprüfen, ob der Pfad exakt übereinstimmt oder mit einem der erlaubten Pfade beginnt
    const isAllowedPath = alwaysAllowedPaths.some(path => 
      req.path === path || req.path.startsWith(`${path}/`)
    );
    
    if (isAllowedPath || isPaymentPath) {
      return next();
    }
    
    // Prüfen, ob der Benutzer nicht aktiviert ist und einen Firmencode hat
    const hasCompanyId = user.companyId !== null && user.companyId !== undefined;
    
    if (!user.isActive && hasCompanyId) {
      // Überprüfen, ob der Pfad trotz nicht aktiviertem Benutzerkonto erlaubt ist
      const isActivationPendingAllowedPath = activationPendingPaths.some(path => 
        req.path === path || req.path.startsWith(`${path}/`)
      );
      
      if (isActivationPendingAllowedPath) {
        // Diesem Pfad darf auch ein nicht aktivierter Benutzer mit Firmenzuordnung zugreifen
        return next();
      }
      
      console.log(`[AUTH] Zugriff verweigert: Benutzer ${user.username} (ID: ${user.id}) hat eine Firma aber ist noch nicht aktiviert`);
      return res.status(403).json({ 
        message: 'Ihr Konto wurde noch nicht von einem Administrator aktiviert.', 
        awaitingActivation: true
      });
    }

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
        // Prüfen, ob der Benutzer pausiert ist
        if (user.isPaused === true) {
          console.log(`[AUTH-OPTIONAL] Benutzer ${user.username} (ID: ${user.id}) ist pausiert`);
          // Im Gegensatz zu requiredAuth blockieren wir nicht, geben aber die Pauseninformation weiter
          req.user = { ...user, isPaused: true };
        } else {
          req.user = user;
        }
        
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

// Hyper-Admin Auth - Erfordert Hyper-Admin-Rechte
export const requireHyperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Erst die normale Auth durchführen
    if (!req.session || !req.session.userId) {
      console.log(`[HYPER-ADMIN-AUTH] Unauthentifizierter Zugriff auf ${req.method} ${req.path}`);
      return res.status(401).json({ message: 'Nicht authentifiziert' });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      console.log(`[HYPER-ADMIN-AUTH] Benutzer mit ID ${req.session.userId} nicht gefunden`);
      return res.status(401).json({ message: 'Benutzer nicht gefunden' });
    }

    // Add user and userId to request
    req.user = user;
    req.userId = user.id;

    // Prüfen, ob der Benutzer ein Hyper-Admin ist
    const isHyperAdmin = await permissionService.isHyperAdmin(req.userId);
    
    if (!isHyperAdmin) {
      console.log(`[HYPER-ADMIN-AUTH] Zugriff verweigert: Benutzer ${user.username} (ID: ${user.id}) ist kein Hyper-Admin`);
      return res.status(403).json({ message: 'Zugriff verweigert. Hyper-Admin-Rechte erforderlich.' });
    }
    
    console.log(`[HYPER-ADMIN-AUTH] Erfolgreicher Zugriff: Hyper-Admin ${user.username} (ID: ${user.id}) auf ${req.method} ${req.path}`);
    
    next();
  } catch (error) {
    console.error('Hyper-Admin auth middleware error:', error);
    res.status(500).json({ message: 'Interner Server-Fehler' });
  }
};

// Company Admin Auth - Erfordert Admin-Rechte in einer Firma
export const requireCompanyAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Erst die normale Auth durchführen
    if (!req.session || !req.session.userId) {
      console.log(`[COMPANY-ADMIN-AUTH] Unauthentifizierter Zugriff auf ${req.method} ${req.path}`);
      return res.status(401).json({ message: 'Nicht authentifiziert' });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      console.log(`[COMPANY-ADMIN-AUTH] Benutzer mit ID ${req.session.userId} nicht gefunden`);
      return res.status(401).json({ message: 'Benutzer nicht gefunden' });
    }

    // Add user and userId to request
    req.user = user;
    req.userId = user.id;

    // Prüfen, ob der Benutzer aktiv ist
    if (!user.isActive) {
      console.log(`[COMPANY-ADMIN-AUTH] Zugriff verweigert: Benutzer ${user.username} (ID: ${user.id}) ist nicht aktiv`);
      return res.status(403).json({ message: 'Ihr Konto ist noch nicht aktiviert.' });
    }

    // Prüfen, ob der Benutzer ein Admin ist
    if (!user.isCompanyAdmin) {
      console.log(`[COMPANY-ADMIN-AUTH] Zugriff verweigert: Benutzer ${user.username} (ID: ${user.id}) ist kein Admin`);
      return res.status(403).json({ message: 'Zugriff verweigert. Admin-Rechte erforderlich.' });
    }
    
    console.log(`[COMPANY-ADMIN-AUTH] Erfolgreicher Zugriff: Admin ${user.username} (ID: ${user.id}) auf ${req.method} ${req.path}`);
    
    next();
  } catch (error) {
    console.error('Company Admin auth middleware error:', error);
    res.status(500).json({ message: 'Interner Server-Fehler' });
  }
};