import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { 
  insertTaskSchema, updateTaskSchema, insertBoardSchema, updateBoardSchema, 
  insertCommentSchema, insertChecklistItemSchema, insertActivityLogSchema, 
  insertColumnSchema, insertUserSchema, insertProjectSchema, updateProjectSchema, 
  insertBoardMemberSchema, insertTeamSchema, insertObjectiveSchema,
  users, boards, projects, objectives, activityLogs, notifications
} from "@shared/schema";
import bcrypt from "bcryptjs";
import type { User } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { registerProductivityRoutes } from "./productivityRoutes";
import { Knex } from 'knex';
import { queryClient, ensureDirectoryExists, generateSecureFilename } from './utils';
import { requireAuth, optionalAuth } from './middleware/auth';
import { permissionService } from './permissions';
import { db, pool } from './db';
import * as schema from '@shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { notificationService } from './notification-service'; // Assuming notificationService is imported


// Configure multer for avatar uploads
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: './uploads/avatars',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Configure multer for general file uploads
const fileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Dynamische Zielverzeichnisse basierend auf dem Upload-Typ
      const type = req.body.type || 'general';
      let uploadDir = './uploads/attachments';
      
      switch(type) {
        case 'task':
          uploadDir = './uploads/attachments/tasks';
          break;
        case 'objective':
          uploadDir = './uploads/attachments/objectives';
          break;
        case 'keyResult':
          uploadDir = './uploads/attachments/key-results';
          break;
        case 'comment':
          uploadDir = './uploads/attachments/comments';
          break;
        default:
          uploadDir = './uploads/attachments';
      }
      
      // Stellen Sie sicher, dass das Verzeichnis existiert
      ensureDirectoryExists(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generieren Sie einen sicheren Dateinamen
      const secureFilename = generateSecureFilename(file.originalname);
      cb(null, secureFilename);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Erlaubte Dateitypen
    const allowedTypes = [
      // Bilder
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Dokumente
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      'text/plain', 'text/csv', 'text/html',
      // Archiv
      'application/zip', 'application/x-rar-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Dateityp nicht erlaubt. Erlaubte Typen sind Bilder, Dokumente, und Archivdateien.'));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB
  }
});

// Stellen Sie sicher, dass die Upload-Verzeichnisse existieren
ensureDirectoryExists('./uploads/avatars');
ensureDirectoryExists('./uploads/attachments');
ensureDirectoryExists('./uploads/attachments/tasks');
ensureDirectoryExists('./uploads/attachments/objectives');
ensureDirectoryExists('./uploads/attachments/key-results');
ensureDirectoryExists('./uploads/attachments/comments');

export async function registerRoutes(app: Express, db: Knex) {
  // Add this health check endpoint at the beginning of route registration
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Current user endpoint
  app.get("/api/auth/current-user", optionalAuth, async (req, res) => {
    try {
      if (!req.userId) {
        return res.json(null);
      }

      const user = await storage.getUser(req.userId, req.userId);
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: "Fehler beim Abrufen des aktuellen Benutzers" });
    }
  });

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(0, result.data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Benutzer existiert bereits" });
      }

      // Validate invite code
      const inviteCode = result.data.inviteCode;
      if (!inviteCode) {
        return res.status(400).json({ message: "Einladungscode ist erforderlich" });
      }

      // Find company with invite code using direct SQL to avoid potential ORM issues
      const companyQuery = await pool.query(
        'SELECT * FROM companies WHERE invite_code = $1',
        [inviteCode]
      );

      console.log("Company database query result:", {
        rowCount: companyQuery.rowCount,
        rows: companyQuery.rows.map(r => ({ id: r.id, name: r.name }))
      });

      if (companyQuery.rowCount === 0) {
        return res.status(400).json({ message: "Ungültiger Einladungscode" });
      }

      const company = companyQuery.rows[0];

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(result.data.password, salt);

      // Create user with company assignment and inactive status using direct SQL
      // to avoid potential issues with Drizzle field conversion
      const userResult = await pool.query(
        `INSERT INTO users 
        (username, email, password_hash, company_id, is_active, is_company_admin) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          result.data.username,
          result.data.email, 
          passwordHash,
          company.id,
          false, // is_active
          false  // is_company_admin
        ]
      );

      if (userResult.rowCount === 0) {
        throw new Error("Fehler beim Erstellen des Benutzers - keine Daten zurückgegeben");
      }

      const user = userResult.rows[0];

      // Convert snake_case to camelCase for response
      const userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
        companyId: user.company_id,
        isCompanyAdmin: user.is_company_admin,
        isActive: user.is_active,
        createdAt: user.created_at
      };

      // Return user object without password hash
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Failed to create user:", error);
      res.status(500).json({ message: "Benutzerregistrierung fehlgeschlagen" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Login attempt with data:", {
        email: req.body.email,
        passwordProvided: !!req.body.password
      });

      const { email, password } = req.body;

      if (!email || !password) {
        console.log("Missing credentials:", { email: !!email, password: !!password });
        return res.status(400).json({ message: "E-Mail und Passwort sind erforderlich" });
      }

      // Direkt aus der Datenbank abrufen, um Probleme mit storage zu umgehen
      const userQuery = await pool.query(
        `SELECT * FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );

      console.log("User lookup SQL result:", { 
        rowCount: userQuery.rowCount,
        userFound: userQuery.rowCount > 0
      });

      if (userQuery.rowCount === 0) {
        return res.status(400).json({ message: "Ungültige Anmeldedaten" });
      }

      const user = userQuery.rows[0];
      console.log("Found user:", {
        id: user.id,
        username: user.username,
        email: user.email,
        companyId: user.company_id,
        hasPasswordHash: !!user.password_hash
      });

      // Verify password - Beachte dass das Datenbankfeld snake_case verwendet
      const passwordHash = user.password_hash;
      console.log("Password comparison:", { 
        password: password, 
        hash: passwordHash,
        hashType: typeof passwordHash,
        hashLength: passwordHash?.length 
      });

      // Führe Vergleich durch und protokolliere Ergebnis
      const isValid = await bcrypt.compare(password, passwordHash);
      console.log("Password verification result:", { isValid });

      if (!isValid) {
        return res.status(400).json({ message: "Ungültige Anmeldedaten" });
      }

      // Check if user is active - nur prüfen, wenn Wert explizit auf false gesetzt ist
      // Standardmäßig ist is_active null, was als aktiv betrachtet wird (für Abwärtskompatibilität)
      if (user.is_active === false) {
        return res.status(403).json({ 
          message: "Ihr Konto wurde noch nicht aktiviert. Bitte warten Sie auf die Aktivierung durch einen Administrator.",
          isActive: false 
        });
      }

      // Set user session
      if (req.session) {
        req.session.userId = user.id;

        // Update last login timestamp
        try {
          await pool.query(
            `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
            [user.id]
          );
          console.log("Updated last login timestamp for user:", user.id);
        } catch (updateError) {
          console.error("Failed to update last login timestamp:", updateError);
          // Continue with login even if update fails
        }

        console.log("Session set for user:", user.id);
      } else {
        console.log("No session object available");
      }

      // Format user in camelCase für die Antwort
      const userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
        companyId: user.company_id,
        isCompanyAdmin: user.is_company_admin,
        isActive: user.is_active,
        lastLoginAt: user.last_login_at,
        subscriptionTier: user.subscription_tier,
        subscriptionExpiresAt: user.subscription_expires_at,
        createdAt: user.created_at
      };

      res.json(userResponse);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Anmeldefehler" });
    }
  });

  // Benutzeraktivierung durch Administrator
  app.patch("/api/companies/:companyId/users/:userId/activate", requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const targetUserId = parseInt(req.params.userId);
      const adminUserId = req.userId as number;
      const { activate = true } = req.body; // Default ist aktivieren, aber kann auch deaktivieren

      if (isNaN(companyId) || isNaN(targetUserId)) {
        return res.status(400).json({ message: "Ungültige Benutzer- oder Unternehmens-ID" });
      }

      // Prüfen, ob der Anfragesteller ein Admin des Unternehmens ist
      const adminQuery = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [adminUserId]
      );

      if (adminQuery.rowCount === 0) {
        return res.status(404).json({ message: "Admin-Benutzer nicht gefunden" });
      }

      const admin = adminQuery.rows[0];

      if (!admin.company_id || !admin.is_company_admin || admin.company_id !== companyId) {
        return res.status(403).json({ 
          message: "Sie haben keine Berechtigung, Benutzer zu aktivieren oder zu deaktivieren" 
        });
      }

      // Prüfen, ob der Zielbenutzer im selben Unternehmen ist
      const targetUserQuery = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [targetUserId]
      );

      if (targetUserQuery.rowCount === 0) {
        return res.status(404).json({ message: "Zielbenutzer nicht gefunden" });
      }

      const targetUser = targetUserQuery.rows[0];

      if (targetUser.company_id !== companyId) {
        return res.status(404).json({ 
          message: "Benutzer nicht gefunden oder nicht in Ihrem Unternehmen" 
        });
      }

      // Benutzer aktivieren oder deaktivieren
      const result = await pool.query(`
        UPDATE users 
        SET is_active = $1
        WHERE id = $2
        RETURNING *
      `, [activate, targetUserId]);

      if (result.rowCount === 0) {
        return res.status(500).json({ message: "Fehler beim Aktualisieren des Benutzerstatus" });
      }

      const updatedUser = result.rows[0];

      // Aktivitätslog erstellen
      const actionDetails = activate 
        ? `Benutzer ${targetUser.username} aktiviert` 
        : `Benutzer ${targetUser.username} deaktiviert`;

      try {
        await pool.query(`
          INSERT INTO activity_logs (action, details, user_id)
          VALUES ($1, $2, $3)
        `, ["update", actionDetails, adminUserId]);
      } catch (error) {
        console.error("Fehler beim Erstellen des Aktivitätslogs:", error);
        // Fehler ignorieren, um die Hauptfunktion nicht zu beeinträchtigen
      }

      // Format user in camelCase für die Antwort
      const userResponse = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatar_url,
        companyId: updatedUser.company_id,
        isCompanyAdmin: updatedUser.is_company_admin,
        isActive: updatedUser.is_active,
        createdAt: updatedUser.created_at
      };

      res.json(userResponse);
    } catch (error) {
      console.error("Fehler beim Ändern des Benutzerstatus:", error);
      res.status(500).json({ message: "Fehler beim Ändern des Benutzerstatus" });
    }
  });

  // Benutzer zur Aktivierung auflisten (nur für Admins)
  app.get("/api/companies/:companyId/users/pending", requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const adminUserId = req.userId as number;

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Ungültige Unternehmens-ID" });
      }

      // Prüfen, ob der Anfragesteller ein Admin des Unternehmens ist
      const adminQuery = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [adminUserId]
      );

      if (adminQuery.rowCount === 0) {
        return res.status(404).json({ message: "Admin-Benutzer nicht gefunden" });
      }

      const admin = adminQuery.rows[0];

      if (!admin.company_id || !admin.is_company_admin || admin.company_id !== companyId) {
        return res.status(403).json({ 
          message: "Sie haben keine Berechtigung, ausstehende Benutzer zu sehen" 
        });
      }

      // Ausstehende Benutzer für dieses Unternehmen abrufen
      const pendingUsersQuery = await pool.query(
        `SELECT id, username, email, avatar_url, created_at 
         FROM users 
         WHERE company_id = $1 AND is_active = false`,
        [companyId]
      );

      // Format für Frontend konvertieren (snake_case zu camelCase)
      const pendingUsers = pendingUsersQuery.rows.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at
      }));

      res.json(pendingUsers);
    } catch (error) {
      console.error("Fehler beim Abrufen ausstehender Benutzer:", error);
      res.status(500).json({ message: "Fehler beim Abrufen ausstehender Benutzer" });
    }
  });

  // Add new route to get all users
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const userId = req.userId as number;

      // Get current user's company using direct SQL query
      const userResult = await pool.query(
        'SELECT company_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].company_id) {
        return res.json([]);
      }

      const companyId = userResult.rows[0].company_id;

      // Get all users from the same company using direct SQL query
      // Nur Benutzer anzeigen, die aktiv sind (is_active = TRUE)
      const companyUsers = await pool.query(
        `SELECT id, username, email, avatar_url, company_id, 
         is_company_admin, is_active, created_at 
         FROM users WHERE company_id = $1 AND is_active = TRUE`,
        [companyId]
      );

      // Transform snake_case to camelCase
      const users = companyUsers.rows.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
        companyId: user.company_id,
        isCompanyAdmin: user.is_company_admin,
        isActive: user.is_active,
        createdAt: user.created_at
      }));

      res.json(users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
      const userId = req.userId as number;
      const user = await storage.getUser(userId, id);
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile update routes
  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.body.userId; // We'll need to add proper auth middleware later
      const { username, email, currentPassword, newPassword } = req.body;

      // If updating password, verify current password first
      if (currentPassword && newPassword) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        await storage.updateUserPassword(userId, passwordHash);
      }

      // Update other user data if provided
      if (username || email) {
        const updateData: Partial<User> = {};
        if (username) updateData.username = username;
        if (email) {
          try {
            await storage.updateUserEmail(userId, email);
          } catch (error) {
            return res.status(400).json({ message: (error as Error).message });
          }
        }

        if (Object.keys(updateData).length > 0) {
          const updatedUser = await storage.updateUser(userId, updateData);
          const { passwordHash: _, ...userWithoutPassword } = updatedUser;
          return res.json(userWithoutPassword);
        }
      }

      res.json({ message: "Profile updated successfully" });
    } catch (error) {
      console.error("Failed to update profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Project routes
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      // Benutze die userId aus dem req-Objekt
      const userId = req.userId!;
      const projects = await storage.getProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt
      const userId = req.userId!;
      const project = await storage.getProject(userId, id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Failed to fetch project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Update the project creation endpoint
  app.post("/api/projects", requireAuth, async (req, res) => {
    const result = insertProjectSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      // Get user ID from request
      const userId = req.userId!;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const project = await storage.createProject(userId, result.data);

      // Log the activity with correct userId
      await storage.createActivityLog({
        action: "create",
        details: "Neues Projekt erstellt",
        userId: userId, // Use consistent userId field
        projectId: project.id
      });

      res.json(project);
    } catch (error) {
      console.error("Failed to create project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const result = updateProjectSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const project = await storage.updateProject(userId, id, result.data);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Log the activity with all relevant IDs
      await storage.createActivityLog({
        action: "update",
        details: "Projekt aktualisiert",
        userId: userId,
        projectId: id,
      });

      res.json(project);
    } catch (error) {
      console.error("Failed to update project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Route zum Hinzufügen/Entfernen von Mitgliedern zu einem Projekt
  app.patch("/api/projects/:id/members", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Projekt-ID" });
    }

    const { memberIds } = req.body;
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: "memberIds muss ein Array sein" });
    }

    try {
      const userId = req.userId!;

      // Projekt aktualisieren
      const updatedProject = await storage.updateProject(userId, id, {
        memberIds: memberIds
      });

      // Aktivitätslog erstellen
      await storage.createActivityLog({
        action: "update",
        details: "Projektmitglieder aktualisiert",
        userId: userId,
        projectId: id,
        requiresNotification: true,
        notificationType: "project"
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Projektmitglieder:", error);
      res.status(500).json({ 
        message: "Fehler beim Aktualisieren der Projektmitglieder", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;

      // Log the activity before deletion
      await storage.createActivityLog({
        action: "delete",
        details: "Projekt gelöscht",
        user_id: userId,
        project_id: id
      });

      await storage.deleteProject(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Archivierungsrouten für Projekte
  app.patch("/api/projects/:id/archive", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Projekt-ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const project = await storage.archiveProject(userId, id);
      res.json(project);
    } catch (error) {
      console.error("Failed to archive project:", error);
      res.status(500).json({ message: "Fehler beim Archivieren des Projekts" });
    }
  });

  app.patch("/api/projects/:id/unarchive", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Projekt-ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const project = await storage.unarchiveProject(userId, id);
      res.json(project);
    } catch (error) {
      console.error("Failed to unarchive project:", error);
      res.status(500).json({ message: "Fehler beim Wiederherstellen des Projekts" });
    }
  });

  // Board routes
  app.get("/api/projects/:projectId/boards", requireAuth, async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const boards = await storage.getBoardsByProject(userId, projectId);
      res.json(boards);
    } catch (error) {
      console.error("Failed to fetch boards:", error);
      res.status(500).json({ message: "Failed to fetch boards" });
    }
  });

  // Update board creation endpoint
  app.post("/api/boards", requireAuth, async (req, res) => {
    try {
      console.log("Received board creation request:", req.body);

      const result = insertBoardSchema.safeParse(req.body);
      if (!result.success) {
        console.error("Board validation failed:", result.error.errors);
        return res.status(400).json({
          message: "Invalid board data",
          errors: result.error.errors,
        });
      }

      // Prepare board data
      const boardData = {
        ...result.data,
        team_ids: Array.isArray(result.data.team_ids) ? result.data.team_ids : [],
        assigned_user_ids: Array.isArray(result.data.assigned_user_ids) ? result.data.assigned_user_ids : [],
        is_favorite: result.data.is_favorite || false
      };

      console.log("Creating board with data:", boardData);
      const board = await storage.createBoard(req.userId!, boardData);
      console.log("Board created:", board);

      // Create activity log entry
      await storage.createActivityLog({
        action: "create",
        details: "Neues Board erstellt",
        userId: req.userId,
        boardId: board.id
      });

      res.status(201).json(board);
    } catch (error) {
      console.error("Failed to create board:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to create board",
        error: error
      });
    }
  });


  app.get("/api/boards", requireAuth, async (req, res) => {
    try {
      console.log("Starting boards fetch...");
      // Benutze die userId aus dem req-Objekt
      const userId = req.userId!;
      const boards = await storage.getBoards(userId);
      console.log(`Successfully retrieved ${boards.length} boards:`, boards);
      res.json(boards);
    } catch (error) {
      console.error("Failed to fetch boards:", error);
      res.status(500).json({
        message: "Failed to fetch boards",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/boards/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      console.error("Invalid board ID received:", req.params.id);
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      console.log(`[GET /api/boards/${id}] Fetching board for user ${userId}...`);

      const board = await storage.getBoard(userId, id);

      if (!board) {
        console.log(`[GET /api/boards/${id}] Board not found or user doesn't have access`);
        return res.status(404).json({ message: "Board not found or you don't have access" });
      }

      console.log(`[GET /api/boards/${id}] Successfully fetched board:`, board);

      // Fetch additional board data
      const columns = await storage.getColumns(userId, id);
      const tasks = await storage.getTasks(userId, id);

      console.log(`[GET /api/boards/${id}] Found ${columns.length} columns and ${tasks.length} tasks`);

      res.json({
        ...board,
        columns,
        tasks,
      });
    } catch (error) {
      console.error(`[GET /api/boards/${id}] Error fetching board:`, error);
      res.status(500).json({
        message: "Failed to fetch board",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.patch("/api/boards/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    const result = updateBoardSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid board data",
        errors: result.error.errors
      });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;

      const updatedBoard = await storage.updateBoard(userId, id, result.data);

      // Log the activity
      await storage.createActivityLog({
        action: "update",
        details: "Board aktualisiert",
        user_id: userId,
        board_id: id
      });

      res.json(updatedBoard);
    } catch (error) {
      console.error("Failed to update board:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update board"
      });
    }
  });

  app.delete("/api/boards/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;

      // Log the activity before deletion
      await storage.createActivityLog({
        action: "delete",
        details: "Board gelöscht",
        user_id: userId,
        board_id: id
      });

      await storage.deleteBoard(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Archivierungsrouten für Boards
  app.patch("/api/boards/:id/archive", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Board-ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const board = await storage.archiveBoard(userId, id);
      res.json(board);
    } catch (error) {
      console.error("Failed to archive board:", error);
      res.status(500).json({ message: "Fehler beim Archivieren des Boards" });
    }
  });

  app.patch("/api/boards/:id/unarchive", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Board-ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const board = await storage.unarchiveBoard(userId, id);
      res.json(board);
    } catch (error) {
      console.error("Failed to unarchive board:", error);
      res.status(500).json({ message: "Fehler beim Wiederherstellen des Boards" });
    }
  });

  // Task routes
  app.get("/api/boards/:boardId/tasks", requireAuth, async (req, res) => {
    const boardId = parseInt(req.params.boardId);
    if (isNaN(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;

      console.log(`Fetching tasks for board ${boardId} for user ${userId}`);
      const tasks = await storage.getTasks(userId, boardId);
      console.log(`Found ${tasks.length} tasks:`, tasks);
      res.json(tasks);
    } catch (error) {
      console.error(`Failed to fetch tasks for board ${boardId}:`, error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Endpunkt zum Abrufen aller Tasks für alle Boards
  app.get("/api/all-tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;

      // Alle Boards des Benutzers abrufen
      const boards = await storage.getBoards(userId);

      // Tasks für jedes Board sammeln
      const allTasks: Record<number, Task[]> = {};

      for (const board of boards) {
        try {
          const tasks = await storage.getTasks(userId, board.id);
          allTasks[board.id] = tasks;
        } catch (error) {
          console.error(`Failed to fetch tasks for board ${board.id}:`, error);
          // Wir setzen ein leeres Array für Boards ohne Aufgaben
          allTasks[board.id] = [];
        }
      }

      res.json(allTasks);
    } catch (error) {
      console.error("Failed to fetch all tasks:", error);
      res.status(500).json({ message: "Failed to fetch all tasks" });
    }
  });

  app.post("/api/boards/:boardId/tasks", requireAuth, async (req, res) => {
    const boardId = parseInt(req.params.boardId);
    if (isNaN(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
    const userId = req.userId!;

    // Füge die userId zum Task hinzu, damit der Ersteller korrekt gesetzt wird
    const result = insertTaskSchema.safeParse({ 
      ...req.body, 
      boardId,
      creatorId: userId
    });

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid task data",
        errors: result.error.errors
      });
    }

    try {
      const task = await storage.createTask(userId, result.data);

      // Log the activity
      await storage.createActivityLog({
        action: "create",
        details: "Neue Aufgabe erstellt",
        userId: userId,
        boardId: boardId,
        taskId: task.id,
        requiresNotification: false, // Keine Benachrichtigung für den Ersteller selbst
        notificationType: "task"
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create task:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const result = updateTaskSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: result.error.message,
        details: result.error.errors
      });
    }

    try {
      const userId = req.userId!;
      const task = await storage.updateTask(userId, id, result.data);

      // Log the activity
      const activityLog = await storage.createActivityLog({
        action: "update",
        details: "Aufgabe aktualisiert",
        userId: userId,
        taskId: id,
        boardId: task.boardId,
        requiresNotification: true,  // Benachrichtigung für Zuweisungen und Updates
        notificationType: "task"
      });

      // Sofort Benachrichtigung verarbeiten
      await notificationService.processActivityLog(activityLog.id);

      res.json(task);
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Comment routes
  app.get("/api/tasks/:taskId/comments", requireAuth, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    try {
      const userId = req.userId!;
      const comments = await storage.getComments(userId, taskId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/tasks/:taskId/comments", requireAuth, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    console.log("Received comment creation request:", {
      body: req.body,
      taskId: taskId
    });

    const result = insertCommentSchema.safeParse({ ...req.body, taskId });
    if (!result.success) {
      console.error("Comment validation failed:", result.error);
      return res.status(400).json({
        message: "Invalid comment data",
        errors: result.error.errors
      });
    }

    try {
      console.log("Validated comment data:", result.data);
      const userId = req.userId!;
      const comment = await storage.createComment(userId, result.data);

      // Erzeuge ein Activity Log, das eine Benachrichtigung auslöst
      const activityLog = await storage.createActivityLog({
        action: "comment",
        details: "Neuer Kommentar hinzugefügt",
        userId: userId,
        taskId: result.data.taskId,
        requiresNotification: true,
        notificationType: "comment"
      });

      await notificationService.processActivityLog(activityLog.id);

      console.log("Created comment:", comment);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Failed to create comment:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Checklist routes
  app.get("/api/tasks/:taskId/checklist", requireAuth, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    try {
      const userId = req.userId!;
      const items = await storage.getChecklistItems(userId, taskId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/tasks/:taskId/checklist", requireAuth, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    console.log("Received checklist item creation request:", {
      body: req.body,
      taskId: taskId
    });

    const result = insertChecklistItemSchema.safeParse({ ...req.body, taskId });
    if (!result.success) {
      console.error("Checklist item validation failed:", result.error);
      return res.status(400).json({
        message: "Invalid checklist item data",
        errors: result.error.errors
      });
    }

    try {
      console.log("Validated checklist item data:", result.data);
      const userId = req.userId!;
      const item = await storage.createChecklistItem(userId, result.data);
      console.log("Created checklist item:", item);
      res.status(201).json(item);
    } catch (error) {
      console.error("Failed to create checklist item:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/checklist/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid checklist item ID" });
    }

    try {
      const userId = req.userId!;
      const item = await storage.updateChecklistItem(userId, id, req.body);
      res.json(item);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/checklist/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid checklist item ID" });
    }

    try {
      const userId = req.userId!;
      await storage.deleteChecklistItem(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Endpunkt zum Abrufen von Aktivitätslogs
  app.get("/api/activity", requireAuth, async (req, res) => {
    try {
      console.log("Fetching activity logs...");

      // Benutzerdaten für Filterung laden
      const userId = req.userId!;

      // Verwende die verbesserte Berechtigungslogik
      const logs = await permissionService.getVisibleActivityLogs(userId);

      console.log("Activity logs query:", logs.length, "results");
      if (logs.length > 0) {
        console.log("Sample activity log:", logs[0]);
      }

      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
      res.status(500).json({
        message: "Failed to fetch activity logs",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpunkt zum Abrufen von Benachrichtigungen
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;

      // Benachrichtigungen des Benutzers abrufen mit Raw-SQL
      const result = await pool.query(`
        SELECT 
          id, 
          user_id AS "userId", 
          title, 
          message, 
          type, 
          link, 
          read, 
          created_at AS "createdAt"
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30
      `, [userId]);

      res.json(result.rows);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({
        message: "Benachrichtigungen konnten nicht abgerufen werden",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Benachrichtigung als gelesen markieren
  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const notificationId = parseInt(req.params.id);

      // Prüfen, ob die Benachrichtigung dem Benutzer gehört
      const checkResult = await pool.query(
        'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: "Benachrichtigung nicht gefunden" });
      }

      // Benachrichtigung als gelesen markieren
      await pool.query(
        'UPDATE notifications SET read = true WHERE id = $1',
        [notificationId]
      );

      res.json({ message: "Benachrichtigung als gelesen markiert" });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      res.status(500).json({
        message: "Benachrichtigung konnte nicht als gelesen markiert werden",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });





  // Alle Benachrichtigungen als gelesen markieren
  app.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;

      // Alle ungelesenen Benachrichtigungen des Benutzers als gelesen markieren
      await pool.query(
        'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
        [userId]
      );

      res.json({ message: "Alle Benachrichtigungen als gelesen markiert" });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      res.status(500).json({
        message: "Benachrichtigungen konnten nicht als gelesen markiert werden",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Benachrichtigungseinstellungen des Benutzers abrufen
  app.get("/api/notification-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;

      // Benachrichtigungseinstellungen des Benutzers abrufen
      const result = await pool.query(`
        SELECT 
          id,
          user_id AS "userId",

          -- Aufgaben
          task_assigned AS "taskAssigned",
          task_due AS "taskDue",
          task_updates AS "taskUpdates",
          task_comments AS "taskComments",

          -- Boards
          board_invite AS "boardInvite",
          board_updates AS "boardUpdates",

          -- Teams
          team_invite AS "teamInvite",
          team_updates AS "teamUpdates",

          -- Projekte
          project_update AS "projectUpdate",

          -- OKRs
          okr_progress AS "okrProgress",
          okr_comments AS "okrComments",

          -- Allgemein
          mentions
        FROM notification_settings
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);

      // Wenn keine Einstellungen gefunden wurden, Standardeinstellungen erstellen
      if (result.rows.length === 0) {
        const defaultSettings = {
          userId,
          taskAssigned: true,
          taskDue: true,
          taskUpdates: true,
          taskComments: true,
          boardInvite: true,
          boardUpdates: true,
          teamInvite: true,
          teamUpdates: true,
          projectUpdate: true,
          okrProgress: true,
          okrComments: true,
          mentions: true
        };

        // Default-Einstellungen in Datenbank einfügen
        const insertResult = await pool.query(`
          INSERT INTO notification_settings (
            user_id, 
            task_assigned, task_due, task_updates, task_comments,
            board_invite, board_updates,
            team_invite, team_updates,
            project_update,
            okr_progress, okr_comments,
            mentions
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          ) RETURNING id
        `, [
          userId, 
          defaultSettings.taskAssigned, defaultSettings.taskDue, defaultSettings.taskUpdates, defaultSettings.taskComments,
          defaultSettings.boardInvite, defaultSettings.boardUpdates,
          defaultSettings.teamInvite, defaultSettings.teamUpdates,
          defaultSettings.projectUpdate,
          defaultSettings.okrProgress, defaultSettings.okrComments,
          defaultSettings.mentions
        ]);

        // ID der neu erstellten Einstellungen hinzufügen
        defaultSettings.id = insertResult.rows[0].id;

        // Default-Einstellungen zurückgeben
        return res.json(defaultSettings);
      }

      // Vorhandene Einstellungen zurückgeben
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Failed to fetch notification settings:", error);
      res.status(500).json({
        message: "Benachrichtigungseinstellungen konnten nicht abgerufen werden",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Benachrichtigungseinstellungen des Benutzers aktualisieren
  app.patch("/api/notification-settings", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const updates = req.body;

      // Prüfen, ob die Einstellungen bereits existieren
      const checkResult = await pool.query(
        'SELECT id FROM notification_settings WHERE user_id = $1',
        [userId]
      );

      // Wenn keine Einstellungen gefunden wurden, Fehler zurückgeben
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: "Benachrichtigungseinstellungen nicht gefunden" });
      }

      const settingsId = checkResult.rows[0].id;

      // Liste der erlaubten Felder und deren DB-Spaltenname
      const allowedFields = {
        taskAssigned: "task_assigned",
        taskDue: "task_due",
        taskUpdates: "task_updates",
        taskComments: "task_comments",
        boardInvite: "board_invite",
        boardUpdates: "board_updates",
        teamInvite: "team_invite",
        teamUpdates: "team_updates",
        projectUpdate: "project_update",
        okrProgress: "okr_progress",
        okrComments: "okr_comments",
        mentions: "mentions"
      };

      // Aktualisierungsspalten und Werte zusammenstellen
      const updatePairs = [];
      const updateValues = [];
      let paramCounter = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (key in allowedFields && typeof value === 'boolean') {
          updatePairs.push(`${allowedFields[key as keyof typeof allowedFields]} = $${paramCounter}`);
          updateValues.push(value);
          paramCounter++;
        }
      }

      // Nur aktualisieren, wenn es tatsächlich etwas zu aktualisieren gibt
      if (updatePairs.length > 0) {
        // Benachrichtigungseinstellungen aktualisieren
        const updateQuery = `
          UPDATE notification_settings 
          SET ${updatePairs.join(', ')} 
          WHERE id = $${paramCounter}
          RETURNING *
        `;
        updateValues.push(settingsId);

        const result = await pool.query(updateQuery, updateValues);

        // Aktualisierte Einstellungen in camelCase umwandeln und zurückgeben
        const updatedSettings = {
          id: result.rows[0].id,
          userId: result.rows[0].user_id,
          taskAssigned: result.rows[0].task_assigned,
          taskDue: result.rows[0].task_due,
          taskUpdates: result.rows[0].task_updates,
          taskComments: result.rows[0].task_comments,
          boardInvite: result.rows[0].board_invite,
          boardUpdates: result.rows[0].board_updates,
          teamInvite: result.rows[0].team_invite,
          teamUpdates: result.rows[0].team_updates,
          projectUpdate: result.rows[0].project_update,
          okrProgress: result.rows[0].okr_progress,
          okrComments: result.rows[0].okr_comments,
          mentions: result.rows[0].mentions
        };

        return res.json(updatedSettings);
      }

      // Wenn keine gültigen Felder zum Aktualisieren gefunden wurden
      res.status(400).json({ message: "Keine gültigen Felder zum Aktualisieren gefunden" });
    } catch (error) {
      console.error("Failed to update notification settings:", error);
      res.status(500).json({
        message: "Benachrichtigungseinstellungen konnten nicht aktualisiert werden",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // GET /api/companies/:id
  app.get("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Ungültige Unternehmens-ID" });
      }

      // Berechtigungsprüfung
      const canAccess = await permissionService.canAccessCompany(req.userId!, companyId);
      if (!canAccess) {
        return res.status(403).json({ message: "Keine Berechtigung zum Zugriff auf dieses Unternehmen" });
      }

      // Direkte SQL-Abfrage über den Pool
      const result = await pool.query(
        'SELECT * FROM companies WHERE id = $1',
        [companyId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Unternehmen nicht gefunden" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Unternehmensdaten" });
    }
  });

  // GET /api/companies/current
  app.get("/api/companies/current", requireAuth, async (req, res) => {
    try {
      console.log(`[COMPANY_DEBUG] Fetching current company for user ID: ${req.userId}`);

      // Prüfen ob der Benutzer authentifiziert ist
      if (!req.userId) {
        console.log("[COMPANY_DEBUG] User not authenticated");
        return res.status(401).json({ message: "Nicht authentifiziert" });
      }

      // Hole die aktuellen Unternehmensdaten direkt mit getCurrentUserCompany
      // Diese Methode prüft bereits ob der User existiert und zu einem Unternehmen gehört
      const company = await storage.getCurrentUserCompany(req.userId);
      console.log("[COMPANY_DEBUG] Company data:", JSON.stringify(company, null, 2));

      // company kann null sein, wenn der User kein Unternehmen hat
      return res.json(company);

    } catch (error) {
      console.error("[COMPANY_DEBUG] Unexpected error:", error);

      // Spezifische Fehlermeldungen für verschiedene Fehlertypen
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: "Benutzer nicht gefunden" });
        } else if (error.message.includes("Ungültige")) {
          return res.status(400).json({ message: error.message });
        }
      }

      // Allgemeiner Serverfehler für alle anderen Fehler
      return res.status(500).json({
        message: "Fehler beim Abrufen der Unternehmensdaten",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // GET /api/companies/members/:companyId
  app.get("/api/companies/members/:companyId", requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Ungültige Unternehmens-ID" });
      }

      // Berechtigungsprüfung
      const canAccess = await permissionService.canAccessCompany(req.userId!, companyId);
      if (!canAccess) {
        return res.status(403).json({ message: "Keine Berechtigung zum Zugriff auf dieses Unternehmen" });
      }

      // Benutzer aus diesem Unternehmen abrufen (nur aktivierte Benutzer)
      const result = await pool.query(`
        SELECT 
          id, 
          username, 
          email, 
          avatar_url AS "avatarUrl", 
          is_company_admin AS "isCompanyAdmin"
        FROM users 
        WHERE company_id = $1 AND is_active = true
      `, [companyId]);

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching company members:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Unternehmensmitglieder" });
    }
  });

  // Column routes
  app.get("/api/boards/:boardId/columns", requireAuth, async (req, res) => {
    const boardId = parseInt(req.params.boardId);
    if (isNaN(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      const userId = req.userId!;
      const columns = await storage.getColumns(userId, boardId);
      res.json(columns);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/boards/:boardId/columns", requireAuth, async (req, res) => {
    const boardId = parseInt(req.params.boardId);
    if (isNaN(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    const result = insertColumnSchema.safeParse({ ...req.body, boardId });
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid column data",
        errors: result.error.errors
      });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const column = await storage.createColumn(userId, result.data);
      res.status(201).json(column);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/columns/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid column ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const column = await storage.updateColumn(userId, id, req.body);
      res.json(column);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/columns/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid column ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      await storage.deleteColumn(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Avatar upload route
  app.post("/api/profile/avatar", requireAuth, avatarUpload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      const updatedUser = await storage.updateUser(userId, userId, { avatarUrl });
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });

  // Add team routes
  app.get("/api/teams", requireAuth, async (req, res) => {
    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const teams = await storage.getTeams(userId);
      res.json(teams);
    } catch (error) {
      console.error("Failed to fetch teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get("/api/teams/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const team = await storage.getTeam(userId, id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Failed to fetch team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.post("/api/teams", requireAuth, async (req, res) => {
    const result = insertTeamSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const team = await storage.createTeam(userId, result.data);
      res.status(201).json(team);
    } catch (error) {
      console.error("Failed to create team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.patch("/api/teams/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    try {
      // Log für Debugging
      console.log("Team update request body:", req.body);

      // Konvertiere member_ids zu Strings, falls sie als Zahlen übergeben werden
      const teamData = {
        ...req.body,
        member_ids: req.body.member_ids 
          ? Array.isArray(req.body.member_ids) 
              ? req.body.member_ids.map(id => id.toString()) 
              : [req.body.member_ids.toString()]
          : undefined
      };

      // Validiere Daten
      const result = insertTeamSchema.partial().safeParse(teamData);
      if (!result.success) {
        console.error("Team validation error:", result.error.format());
        return res.status(400).json({ 
          message: "Invalid team data", 
          errors: result.error.errors 
        });
      }

      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const team = await storage.updateTeam(userId, id, result.data);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Failed to update team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });
  app.delete("/api/teams/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      await storage.deleteTeam(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Add toggle favorite endpoints
  app.patch("/api/projects/:id/favorite", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const project = await storage.toggleProjectFavorite(userId, id);
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle favorite status" });
    }
  });

  app.patch("/api/boards/:id/favorite", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const board = await storage.toggleBoardFavorite(userId, id);
      res.json(board);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle favorite status" });
    }
  });

  app.patch("/api/objectives/:id/favorite", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid objective ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const objective = await storage.toggleObjectiveFavorite(userId, id);
      res.json(objective);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle favorite status" });
    }
  });

  // Activity logs endpoint - Entfernt, da bereits oben implementiert

  // Register productivity routes
  registerProductivityRoutes(app);

  // Register OKR routes
  const { registerOkrRoutes } = await import("./okrRoutes.js");
  registerOkrRoutes(app);

  // Company routes - Restliche Routen, /api/companies/:id wurde bereits oben definiert

  app.get("/api/companies/:companyId/members", requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Ungültige Unternehmens-ID" });
      }

      const members = await storage.getCompanyMembers(req.userId as number, companyId);
      res.json(members);
    } catch (error) {
      console.error("Error in GET /api/companies/:companyId/members:", error);
      res.status(500).json({ error: "Fehler beim Abrufen der Unternehmensmitglieder" });
    }
  });

  app.patch("/api/companies/members/:userId/role", requireAuth, async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.userId);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: "Ungültige Benutzer-ID" });
      }

      const { isAdmin } = req.body;
      if (typeof isAdmin !== 'boolean') {
        return res.status(400).json({ error: "isAdmin muss ein boolescher Wert sein" });
      }

      const user = await storage.updateUserCompanyRole(req.userId as number, targetUserId, isAdmin);
      res.json(user);
    } catch (error) {
      console.error("Error in PATCH /api/companies/members/:userId/role:", error);
      res.status(500).json({ error: "Fehler beim Aktualisieren der Benutzerrolle" });
    }
  });

  app.post("/api/companies/:companyId/invite", requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Ungültige Unternehmens-ID" });
      }

      const inviteCode = await storage.generateCompanyInviteCode(req.userId as number, companyId);
      res.json({ inviteCode });
    } catch (error) {
      console.error("Error in POST /api/companies/:companyId/invite:", error);
      res.status(500).json({ error: "Fehler beim Generieren des Einladungscodes" });
    }
  });

  app.post("/api/companies/join", requireAuth, async (req, res) => {
    try {
      const { inviteCode } = req.body;
      if (!inviteCode || typeof inviteCode !== 'string') {
        return res.status(400).json({ error: "Gültiger Einladungscode erforderlich" });
      }

      const company = await storage.joinCompanyWithInviteCode(req.userId as number, inviteCode);
      res.json(company);
    } catch (error) {
      console.error("Error in POST /api/companies/join:", error);
      res.status(500).json({ error: "Fehler beim Beitreten zum Unternehmen" });
    }
  });

  app.post("/api/companies", requireAuth, async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Unternehmensname ist erforderlich" });
      }

      const companyData = {
        name,
        description: description || null
      };

      const company = await storage.createCompany(req.userId as number, companyData);
      res.status(201).json(company);
    } catch (error: any) {
      console.error("Error in POST /api/companies:", error);

      // Spezifische Fehlermeldungen für bekannte Fehler
      if (error.message && (
        error.message.includes("Die Erstellung eines Unternehmens erfordert mindestens ein Basic-Abonnement") ||
        error.message.includes("Sie sind bereits Mitglied eines Unternehmens")
      )) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Fehler beim Erstellen des Unternehmens" });
    }
  });

  // Add team-members route
  app.get("/api/team-members", requireAuth, async (req, res) => {
    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      const result = await storage.getTeamMembers(userId);
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });
  
  // Datei-Upload-Endpunkt für allgemeine Uploads (Tasks, Objectives, KeyResults, etc.)
  app.post("/api/upload", requireAuth, fileUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Keine Datei hochgeladen" });
      }

      const userId = req.userId as number;
      const { type = 'general', entityId } = req.body;
      
      // Pfad relativ zum Server-Root
      const filePath = req.file.path.replace(/^\.\//, '/');
      
      // Protokolliert den Upload für Debugging
      console.log("Datei hochgeladen:", {
        userId,
        type,
        entityId,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: filePath
      });
      
      // Erstellt einen Aktivitätslog für den Upload, falls ein entityId vorhanden ist
      if (entityId) {
        try {
          const entityIdNum = parseInt(entityId);
          if (!isNaN(entityIdNum)) {
            // Je nach Uploadtyp den entsprechenden Aktivitätslog erstellen
            const logData: any = {
              action: "upload",
              details: `Datei "${req.file.originalname}" hochgeladen`,
              user_id: userId
            };
            
            // Setze die entsprechenden IDs basierend auf dem Upload-Typ
            switch(type) {
              case 'task':
                logData.task_id = entityIdNum;
                // Hole board_id für die Task
                try {
                  const taskResult = await pool.query(
                    'SELECT board_id FROM tasks WHERE id = $1',
                    [entityIdNum]
                  );
                  if (taskResult.rows.length > 0) {
                    logData.board_id = taskResult.rows[0].board_id;
                  }
                } catch (err) {
                  console.error("Fehler beim Abrufen der Board-ID für die Task:", err);
                }
                break;
              case 'objective':
                logData.objective_id = entityIdNum;
                break;
              case 'keyResult':
                logData.key_result_id = entityIdNum;
                // Hole objective_id für das Key Result
                try {
                  const krResult = await pool.query(
                    'SELECT objective_id FROM key_results WHERE id = $1',
                    [entityIdNum]
                  );
                  if (krResult.rows.length > 0) {
                    logData.objective_id = krResult.rows[0].objective_id;
                  }
                } catch (err) {
                  console.error("Fehler beim Abrufen der Objective-ID für das Key Result:", err);
                }
                break;
              case 'comment':
                // Hier könnten wir die Task-ID oder Objective-ID aus dem Kommentar abrufen,
                // aber das ist komplexer und würde mehr Logik erfordern
                logData.comment_id = entityIdNum;
                break;
            }
            
            // Aktivitätslog erstellen
            const activityLog = await storage.createActivityLog(logData);
            
            // Benachrichtigungen für den Upload verarbeiten
            await notificationService.processActivityLog(activityLog.id);
          }
        } catch (logError) {
          console.error("Fehler beim Erstellen des Aktivitätslogs für den Upload:", logError);
          // Wir brechen hier nicht ab, da der Upload selbst erfolgreich war
        }
      }
      
      // Erfolgreiche Antwort senden
      res.json({
        url: filePath,
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    } catch (error) {
      console.error("Fehler beim Hochladen der Datei:", error);
      res.status(500).json({ message: "Fehler beim Hochladen der Datei" });
    }
  });

  // Update objective creation endpoint
  app.post("/api/objectives", requireAuth, async (req, res) => {
    try {
      console.log("Received objective creation request:", req.body);

      const result = insertObjectiveSchema.safeParse(req.body);
      if (!result.success) {
        console.error("Objective validation failed:", result.error.errors);
        return res.status(400).json({
          message: "Invalid objective data",
          errors: result.error.errors,
        });
      }

      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      result.data.creatorId = userId; // Setze creatorId auf die authentifizierte userId

      // Create the objective
      console.log("Creating objective with validated data:", result.data);
      const objective = await storage.createObjective(userId, result.data);
      console.log("Created objective:", objective);

      // Create activity log
      console.log("Creating activity log with data:", {
        action: "create",
        details: "Neues OKR erstellt",
        user_id: result.data.creatorId,
        objective_id: objective.id,
        project_id: result.data.projectId || null
      });

      const activityLog = await storage.createActivityLog({
        action: "create",
        details: "Neues OKR erstellt",
        user_id: result.data.creatorId,
        objective_id: objective.id,
        project_id: result.data.projectId || null,
        board_id: null,
        task_id: null
      });

      await notificationService.processActivityLog(activityLog.id);


      console.log("Activity log created:", activityLog);

      res.status(201).json(objective);
    } catch (error) {
      console.error("Failed to create objective:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to create objective",
        error: error
      });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    try {
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;

      // Holen Sie zuerst die Task, um die boardId zu bekommen
      const task = await storage.getTasks(userId, null).then(tasks => 
        tasks.find(t => t.id === id)
      );

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const activityLog = await storage.createActivityLog({
        action: "delete",
        details: "Aufgabe gelöscht",
        user_id: userId,
        task_id: id,
        board_id: task.boardId
      });

      await notificationService.processActivityLog(activityLog.id);

      await storage.deleteTask(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // No need to return createServer(app) anymore since we're creating the server in index.ts
}