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
      const existingUser = await storage.getUserByEmail(result.data.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(result.data.password, salt);

      // Create user
      const user = await storage.createUser({
        username: result.data.username,
        email: result.data.email,
        passwordHash,
      });

      // Remove password hash from response
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Failed to create user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    try {
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Remove password hash from response
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Failed to login:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Add new route to get all users
  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getUsers();
      // Entferne sensitive Daten vor dem Senden
      const safeUsers = users.map(({ passwordHash, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
      const user = await storage.getUser(id);
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile update routes
  app.patch("/api/profile", async (req, res) => {
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
  app.get("/api/projects", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
      const project = await storage.getProject(id);
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
  app.post("/api/projects", async (req, res) => {
    const result = insertProjectSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const project = await storage.createProject(result.data);

      // Log the activity with all relevant IDs
      await storage.createActivityLog({
        action: "create",
        details: "Neues Projekt erstellt",
        userId: result.data.creator_id,
        projectId: project.id,
        boardId: null,
        objectiveId: null,
        taskId: null
      });

      res.status(201).json(project);
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
        userId: result.data.creator_id,
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

  app.delete("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
      const userId = req.body.userId; // Assuming we pass the user ID who is deleting the project

      // Log the activity before deletion
      await storage.createActivityLog({
        action: "delete",
        details: "Projekt gelöscht",
        userId: parseInt(userId),
        projectId: id
      });

      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Board routes
  app.get("/api/projects/:projectId/boards", async (req, res) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
      const boards = await storage.getBoardsByProject(projectId);
      res.json(boards);
    } catch (error) {
      console.error("Failed to fetch boards:", error);
      res.status(500).json({ message: "Failed to fetch boards" });
    }
  });

  // Update the board creation endpoint
  app.post("/api/boards", async (req, res) => {
    try {
      const result = insertBoardSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Invalid board data",
          errors: result.error.errors,
        });
      }

      const board = await storage.createBoard(result.data);

      // Log the activity
      await storage.createActivityLog({
        action: "create",
        details: "Neues Board erstellt",
        userId: result.data.creator_id,
        boardId: board.id
      });

      res.status(201).json(board);
    } catch (error) {
      console.error("Failed to create board:", error);
      res.status(500).json({ message: "Failed to create board" });
    }
  });


  app.get("/api/boards", async (_req, res) => {
    try {
      console.log("Starting boards fetch...");
      const boards = await storage.getBoards();
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

  app.get("/api/boards/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      console.error("Invalid board ID received:", req.params.id);
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      console.log(`[GET /api/boards/${id}] Fetching board...`);
      const board = await storage.getBoard(id);

      if (!board) {
        console.log(`[GET /api/boards/${id}] Board not found`);
        return res.status(404).json({ message: "Board not found" });
      }

      console.log(`[GET /api/boards/${id}] Successfully fetched board:`, board);

      // Fetch additional board data
      const columns = await storage.getColumns(id);
      const tasks = await storage.getTasks(id);

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

  app.patch("/api/boards/:id", async (req, res) => {
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
      const updatedBoard = await storage.updateBoard(id, result.data);

      // Log the activity
      await storage.createActivityLog({
        action: "update",
        details: "Board aktualisiert",
        userId: result.data.creator_id,
        boardId: id
      });

      res.json(updatedBoard);
    } catch (error) {
      console.error("Failed to update board:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update board"
      });
    }
  });

  app.delete("/api/boards/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      const userId = req.body.userId; // Assuming we pass the user ID who is deleting the board

      // Log the activity before deletion
      await storage.createActivityLog({
        action: "delete",
        details: "Board gelöscht",
        userId: userId,
        boardId: id
      });

      await storage.deleteBoard(id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Task routes
  app.get("/api/boards/:boardId/tasks", async (req, res) => {
    const boardId = parseInt(req.params.boardId);
    if (isNaN(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    console.log(`Fetching tasks for board ${boardId}`);
    const tasks = await storage.getTasks(boardId);
    console.log(`Found ${tasks.length} tasks:`, tasks);
    res.json(tasks);
  });

  app.post("/api/boards/:boardId/tasks", async (req, res) => {
    const boardId = parseInt(req.params.boardId);
    if (isNaN(boardId)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    const result = insertTaskSchema.safeParse({ ...req.body, boardId });
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid task data",
        errors: result.error.errors
      });
    }

    try {
      const task = await storage.createTask(result.data);

      // Log the activity
      await storage.createActivityLog({
        action: "create",
        details: "Neue Aufgabe erstellt",
        userId: result.data.creatorId,
        boardId: boardId,
        taskId: task.id
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create task:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
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
      const task = await storage.updateTask(id, result.data);

      // Log the activity
      await storage.createActivityLog({
        action: "update",
        details: "Aufgabe aktualisiert",
        userId: result.data.creatorId,
        taskId: id,
        boardId: task.boardId
      });

      res.json(task);
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    try {
      const userId = req.body.userId; // Assuming we pass the user ID who is deleting the task
      await storage.createActivityLog({
        action: "delete",
        details: "Aufgabe gelöscht",
        userId: userId,
        taskId: id,
        boardId: (await storage.getTask(id)).boardId
      });
      await storage.deleteTask(id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Comment routes
  app.get("/api/tasks/:taskId/comments", async (req, res) => {
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

  app.post("/api/tasks/:taskId/comments", async (req, res) => {
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
  app.get("/api/tasks/:taskId/checklist", async (req, res) => {
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

  app.post("/api/tasks/:taskId/checklist", async (req, res) => {
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

  app.patch("/api/checklist/:id", async (req, res) => {
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

  app.delete("/api/checklist/:id", async (req, res) => {
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

  // Activity Log routes
  app.get("/api/tasks/:taskId/activities", async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    try {
      const logs = await storage.getActivityLogs(taskId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/tasks/:taskId/activities", async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    console.log("Received activity log creation request:", {
      body: req.body,
      taskId: taskId
    });

    const result = insertActivityLogSchema.safeParse({ ...req.body, taskId });
    if (!result.success) {
      console.error("Activity log validation failed:", result.error);
      return res.status(400).json({
        message: "Invalid activity log data",
        errors: result.error.errors
      });
    }

    try {
      console.log("Validated activity log data:", result.data);
      const log = await storage.createActivityLog(result.data);
      console.log("Created activity log:", log);
      res.status(201).json(log);
    } catch (error) {
      console.error("Failed to create activity log:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Column routes
  app.get("/api/boards/:boardId/columns", async (req, res) => {
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

  app.post("/api/boards/:boardId/columns", async (req, res) => {
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
      const column = await storage.createColumn(result.data);
      res.status(201).json(column);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.patch("/api/columns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid column ID" });
    }

    try {
      const column = await storage.updateColumn(id, req.body);
      res.json(column);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/columns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid column ID" });
    }

    try {
      await storage.deleteColumn(id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  // Avatar upload route
  app.post("/api/profile/avatar", upload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = parseInt(req.body.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      const updatedUser = await storage.updateUser(userId, { avatarUrl });
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });

  // Add team routes
  app.get("/api/teams", async (_req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Failed to fetch teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get("/api/teams/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    try {
      const team = await storage.getTeam(id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Failed to fetch team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.post("/api/teams", async (req, res) => {
    const result = insertTeamSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const team = await storage.createTeam(result.data);
      res.status(201).json(team);
    } catch (error) {
      console.error("Failed to create team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.patch("/api/teams/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const result = insertTeamSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const team = await storage.updateTeam(id, result.data);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Failed to update team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    try {
      await storage.deleteTeam(id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Add toggle favorite endpoints
  app.patch("/api/projects/:id/favorite", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    try {
            const project = await storage.toggleProjectFavorite(id);
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle favorite status" });
    }
  });

  app.patch("/api/boards/:id/favorite", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      const board = await storage.toggleBoardFavorite(id);
      res.json(board);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle favorite status" });
    }
  });

  app.patch("/api/objectives/:id/favorite", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid objective ID" });
    }

    try {
      const objective = await storage.toggleObjectiveFavorite(id);
      res.json(objective);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle favorite status" });
    }
  });

  // Add activity logs endpoint
  app.get("/api/activity", async (_req, res) => {
    try {
      console.log("Fetching activity logs...");

      // Get activity logs with related information - using simpler joins
      const logs = await db
        .select(
          'activity_logs.*',
          'boards.title as board_title',
          'boards.id as board_id',
          'projects.title as project_title',
          'projects.id as project_id',
          'objectives.title as okr_title',
          'objectives.id as okr_id',
          'users.username as user_name',
          'users.id as user_id'
        )
        .from('activity_logs')
        .leftJoin('users', 'activity_logs.user_id', 'users.id')
        .leftJoin('boards', 'activity_logs.board_id', 'boards.id')
        .leftJoin('projects', 'activity_logs.project_id', 'projects.id')
        .leftJoin('objectives', 'activity_logs.objective_id', 'objectives.id')
        .orderBy('activity_logs.created_at', 'desc')
        .limit(30);

      console.log("SQL Query executed successfully");
      console.log("Number of logs retrieved:", logs.length);

      if (logs.length > 0) {
        console.log("Sample log entry:", logs[0]);
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

  // Register productivity routes
  registerProductivityRoutes(app);

  // Register OKR routes
  const { registerOkrRoutes } = await import("./okrRoutes.js");
  registerOkrRoutes(app);

  // Add team-members route
  app.get("/api/team-members", async (_req, res) => {
    try {
      const result = await storage.getTeamMembers();
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });


  // Update objective creation endpoint
  app.post("/api/objectives", async (req, res) => {
    const result = insertObjectiveSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const objective = await storage.createObjective(result.data);

      // Log the activity
      await storage.createActivityLog({
        action: "create",
        details: "Neues OKR erstellt",
        userId: result.data.creator_id,
        objectiveId: objective.id
      });

      res.status(201).json(objective);
    } catch (error) {
      console.error("Failed to create objective:", error);
      res.status(500).json({ message: "Failed to create objective" });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
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
      const task = await storage.updateTask(id, result.data);

      // Log the activity
      await storage.createActivityLog({
        action: "update",
        details: "Aufgabe aktualisiert",
        userId: result.data.creatorId,
        taskId: id,
        boardId: task.boardId
      });

      res.json(task);
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    try {
      const userId = req.body.userId; // Assuming we pass the user ID who is deleting the task
      await storage.createActivityLog({
        action: "delete",
        details: "Aufgabe gelöscht",
        userId: userId,
        taskId: id,
        boardId: (await storage.getTask(id)).boardId
      });
      await storage.deleteTask(id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  return createServer(app);
}