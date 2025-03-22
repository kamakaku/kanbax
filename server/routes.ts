import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertTaskSchema, updateTaskSchema, insertBoardSchema, updateBoardSchema, insertCommentSchema, insertChecklistItemSchema, insertActivityLogSchema, insertColumnSchema, insertUserSchema, insertProjectSchema, updateProjectSchema, insertBoardMemberSchema, insertTeamSchema, insertObjectiveSchema } from "@shared/schema";
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
import { db } from './db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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

      // Find company with invite code
      const [company] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.inviteCode, inviteCode));

      if (!company) {
        return res.status(400).json({ message: "Ungültiger Einladungscode" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(result.data.password, salt);

      // Create user with company assignment and inactive status
      const user = await storage.createUser(0, {
        username: result.data.username,
        email: result.data.email,
        passwordHash,
        companyId: company.id,
        isActive: false,  // User needs to be activated by admin
        isCompanyAdmin: false,
      });

      // Remove password hash from response
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
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

      // Find user
      const user = await storage.getUserByEmail(0, email);
      console.log("User lookup result:", { userFound: !!user });

      if (!user) {
        return res.status(400).json({ message: "Ungültige Anmeldedaten" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      console.log("Password verification:", { isValid });

      if (!isValid) {
        return res.status(400).json({ message: "Ungültige Anmeldedaten" });
      }

      // Check if user is active - nur prüfen, wenn Wert explizit auf false gesetzt ist
      // Standardmäßig ist isActive null, was als aktiv betrachtet wird (für Abwärtskompatibilität)
      if (user.isActive === false) {
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
          await db.execute(`
            UPDATE users 
            SET "lastLoginAt" = NOW() 
            WHERE id = $1
          `, [user.id]);
          console.log("Updated last login timestamp for user:", user.id);
        } catch (updateError) {
          console.error("Failed to update last login timestamp:", updateError);
          // Continue with login even if update fails
        }
          
        console.log("Session set for user:", user.id);
      } else {
        console.log("No session object available");
      }

      // Remove password hash from response
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
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

      if (isNaN(companyId) || isNaN(targetUserId)) {
        return res.status(400).json({ message: "Ungültige Benutzer- oder Unternehmens-ID" });
      }

      // Prüfen, ob der Anfragesteller ein Admin des Unternehmens ist
      const [admin] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, adminUserId));

      if (!admin || !admin.companyId || !admin.isCompanyAdmin || admin.companyId !== companyId) {
        return res.status(403).json({ message: "Sie haben keine Berechtigung, Benutzer zu aktivieren" });
      }

      // Prüfen, ob der Zielbenutzer im selben Unternehmen ist
      const [targetUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, targetUserId));

      if (!targetUser || targetUser.companyId !== companyId) {
        return res.status(404).json({ message: "Benutzer nicht gefunden oder nicht in Ihrem Unternehmen" });
      }

      // Benutzer aktivieren
      // Verwende Raw-SQL statt Builder-API
      const result = await db.execute(`
        UPDATE users 
        SET "isActive" = true 
        WHERE id = $1
        RETURNING *
      `, [targetUserId]);
      
      const updatedUser = result.rows[0];

      // Aktivitätslog erstellen
      await storage.createActivityLog({
        action: "update",
        details: `Benutzer ${targetUser.username} aktiviert`,
        userId: adminUserId,
        visibleToUsers: [targetUserId, adminUserId]
      });

      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Fehler beim Aktivieren des Benutzers:", error);
      res.status(500).json({ message: "Fehler beim Aktivieren des Benutzers" });
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
      const [admin] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, adminUserId));

      if (!admin || !admin.companyId || !admin.isCompanyAdmin || admin.companyId !== companyId) {
        return res.status(403).json({ message: "Sie haben keine Berechtigung, ausstehende Benutzer zu sehen" });
      }

      // Ausstehende Benutzer für dieses Unternehmen abrufen
      const pendingUsers = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          email: schema.users.email,
          avatarUrl: schema.users.avatarUrl,
          createdAt: schema.users.createdAt
        })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.companyId, companyId),
            eq(schema.users.isActive, false)
          )
        );

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
      const users = await storage.getUsers(userId);
      // Entferne sensitive Daten vor dem Senden
      const safeUsers = users.map(({ passwordHash, ...user }) => user);
      res.json(safeUsers);
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
      // Get user ID from request body
      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const project = await storage.createProject(result.data);

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

  app.patch("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const result = updateProjectSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const project = await storage.updateProject(id, result.data);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Log the activity with all relevant IDs
      await storage.createActivityLog({
        action: "update",
        details: "Projekt aktualisiert",
        userId: result.data.creator_id, // Using creator_id from request body for consistency.  Consider userId if available.
        projectId: id,
        boardId: null,
        objectiveId: null,
        taskId: null
      });

      res.json(project);
    } catch (error) {
      console.error("Failed to update project:", error);
      res.status(500).json({ message: "Failed to update project" });
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
      const board = await storage.createBoard(boardData);
      console.log("Board created:", board);

      // Create activity log entry
      await storage.createActivityLog({
        action: "create",
        details: "Neues Board erstellt",
        userId: result.data.creator_id,
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
      const comments = await storage.getComments(taskId);
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
      const comment = await storage.createComment(result.data);
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
      const items = await storage.getChecklistItems(taskId);
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
      const item = await storage.createChecklistItem(result.data);
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
      const item = await storage.updateChecklistItem(id, req.body);
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
      await storage.deleteChecklistItem(id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Update activity logs endpoint
  app.get("/api/activity", requireAuth, async (req, res) => {
    try {
      console.log("Fetching activity logs...");
      
      // Benutze die userId aus dem req-Objekt für Berechtigungsprüfung
      const userId = req.userId!;
      
      // Verwende die getVisibleActivityLogs-Methode vom permissionService
      // Diese Methode filtert nur die Logs, die der Benutzer sehen darf
      const logs = await permissionService.getVisibleActivityLogs(userId);

      console.log("Activity logs query:", logs.length, "results");
      if (logs.length > 0) {
        console.log("Sample activity log with user info:", logs[0]);
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

      const company = await db.query.companies.findFirst({
        where: eq(schema.companies.id, companyId)
      });

      if (!company) {
        return res.status(404).json({ message: "Unternehmen nicht gefunden" });
      }

      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Unternehmensdaten" });
    }
  });

  // GET /api/companies/current
  app.get("/api/companies/current", requireAuth, async (req, res) => {
    try {
      console.log(`Fetching current company for user ID: ${req.userId}`);
      
      if (!req.userId) {
        return res.status(401).json({ message: "Nicht authentifiziert" });
      }
      
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, req.userId)
      });

      console.log(`User found: ${!!user}, has companyId: ${!!user?.companyId}`);

      if (!user) {
        return res.status(404).json({ message: "Benutzer nicht gefunden" });
      }
      
      if (!user.companyId) {
        // Der Benutzer hat kein Unternehmen - wir geben null zurück,
        // damit das Frontend erkennen kann, dass kein Unternehmen zugewiesen ist
        console.log("User has no company assigned");
        return res.status(200).json(null);
      }

      const company = await db.query.companies.findFirst({
        where: eq(schema.companies.id, user.companyId)
      });

      console.log(`Company found: ${!!company}`);

      if (!company) {
        // Ungültige Unternehmens-ID im Benutzerprofil - ein Fehlerfall
        return res.status(404).json({ message: "Unternehmen nicht gefunden" });
      }

      // Erfolgreiche Antwort mit den Unternehmensdaten
      res.json(company);
    } catch (error) {
      console.error("Error fetching current company:", error);
      res.status(500).json({ 
        message: "Fehler beim Abrufen der aktuellen Unternehmensdaten",
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

      // Benutzer aus diesem Unternehmen abrufen
      const members = await db.query.users.findMany({
        where: eq(schema.users.companyId, companyId),
        columns: {
          id: true,
          username: true,
          email: true, 
          avatarUrl: true,
          isCompanyAdmin: true
        }
      });

      res.json(members);
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
      const columns = await storage.getColumns(boardId);
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

    const result = insertTeamSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
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

  // Company routes - Diese Methode wurde nach oben verschoben und verbessert

  app.get("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Ungültige Unternehmens-ID" });
      }
      
      const company = await storage.getCompany(req.userId as number, companyId);
      res.json(company);
    } catch (error) {
      console.error("Error in GET /api/companies/:id:", error);
      res.status(500).json({ error: "Fehler beim Abrufen des Unternehmens" });
    }
  });

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