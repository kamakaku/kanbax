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
import { queryClient } from './utils'; // Assuming queryClient is imported from a utils file
import { requireAuth, optionalAuth } from './middleware/auth';
import { permissionService } from './permissions';
import { db, pool } from './db';
import * as schema from '@shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';

// Configure multer for avatar uploads
const upload = multer({
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

// Ensure upload directory exists
if (!fs.existsSync('./uploads/avatars')) {
  fs.mkdirSync('./uploads/avatars', { recursive: true });
}

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
        user_id: userId,
        board_id: boardId,
        task_id: task.id
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
      await storage.createActivityLog({
        action: "update",
        details: "Aufgabe aktualisiert",
        user_id: userId,
        task_id: id,
        board_id: task.boardId
      });

      res.json(task);
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Erster Task-Lösch-Endpunkt wird entfernt, da wir einen besseren am Ende der Datei haben

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
      
      // Aktivitätslogs direkt über SQL abfragen, ohne team_id und target_user_id (existieren nicht)
      const result = await pool.query(`
        SELECT 
          a.id, 
          a.action, 
          a.details, 
          a.user_id AS "userId", 
          a.board_id AS "boardId", 
          a.project_id AS "projectId", 
          a.objective_id AS "objectiveId", 
          a.task_id AS "taskId", 
          -- Wir verwenden 0 als Standard-Wert für teamId, da die Spalte in der Tabelle nicht existiert
          0 AS "teamId", 
          -- target_user_id existiert auch nicht
          0 AS "targetUserId", 
          a.created_at AS "createdAt",
          b.title AS board_title, 
          p.title AS project_title, 
          o.title AS objective_title, 
          u.username, 
          u.avatar_url AS avatar_url
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN boards b ON a.board_id = b.id
        LEFT JOIN projects p ON a.project_id = p.id
        LEFT JOIN objectives o ON a.objective_id = o.id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT 50
      `, [userId]);

      const logs = result.rows;
      
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
  
  // Der POST-Endpunkt wurde entfernt, da wir bereits einen PATCH-Endpunkt für die gleiche Funktionalität haben

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
  app.post("/api/profile/avatar", requireAuth, upload.single('avatar'), async (req, res) => {
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

  // Add activity logs endpoint
  //This route is removed as it's a duplicate

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
      
      await storage.createActivityLog({
        action: "delete",
        details: "Aufgabe gelöscht",
        user_id: userId,
        task_id: id,
        board_id: task.boardId
      });
      
      await storage.deleteTask(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });
  
  // No need to return createServer(app) anymore since we're creating the server in index.ts
}