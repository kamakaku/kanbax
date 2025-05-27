import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { permissionService } from "./permissions";
import { requireAuth } from './middleware/auth';
import crypto from "crypto";

/**
 * REST API für Drittanbieter-Integrationen
 * Bietet sichere API-Endpunkte für externe Anwendungen
 */

interface APIKey {
  id: string;
  name: string;
  key: string;
  userId: number;
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

interface APIUser {
  id: number;
  username: string;
  email: string;
  companyId?: number;
}

// In-Memory API Key Store (in Produktion sollte dies in der Datenbank gespeichert werden)
const apiKeys = new Map<string, APIKey>();

/**
 * Generiert einen neuen API-Schlüssel
 */
function generateAPIKey(): string {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Middleware für API-Authentifizierung
 */
async function authenticateAPI(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'API key required. Use Authorization: Bearer YOUR_API_KEY' 
    });
  }

  const apiKey = authHeader.substring(7);
  const keyData = apiKeys.get(apiKey);

  if (!keyData || !keyData.isActive) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or inactive API key' 
    });
  }

  // Letzten Verwendungszeitpunkt aktualisieren
  keyData.lastUsed = new Date();

  // Benutzerinformationen für nachfolgende Middleware verfügbar machen
  const user = await storage.getUser(keyData.userId);
  if (!user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Associated user not found' 
    });
  }

  req.user = user;
  req.apiKey = keyData;
  next();
}

/**
 * Middleware für Berechtigungsprüfung
 */
function requirePermission(permission: string) {
  return (req: Request, res: Response, next: Function) => {
    const apiKey = req.apiKey as APIKey;
    
    if (!apiKey.permissions.includes(permission) && !apiKey.permissions.includes('*')) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Permission '${permission}' required` 
      });
    }
    
    next();
  };
}

/**
 * Registriert alle REST API-Routen
 */
export function registerAPIRoutes(app: Express) {
  
  // API Key Management
  app.post("/api/v1/keys", requireAuth, async (req: Request, res: Response) => {

    const { name, permissions = ['read'] } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Key name is required' });
    }

    const apiKey: APIKey = {
      id: crypto.randomUUID(),
      name,
      key: generateAPIKey(),
      userId: req.user.id,
      permissions,
      createdAt: new Date(),
      isActive: true
    };

    apiKeys.set(apiKey.key, apiKey);

    res.json({
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key, // Nur beim Erstellen zurückgeben
      permissions: apiKey.permissions,
      createdAt: apiKey.createdAt
    });
  });

  app.get("/api/v1/keys", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userKeys = Array.from(apiKeys.values())
      .filter(key => key.userId === req.user.id)
      .map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        isActive: key.isActive
      }));

    res.json(userKeys);
  });

  app.delete("/api/v1/keys/:keyId", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { keyId } = req.params;
    
    // Finde den Schlüssel
    let keyToDelete: APIKey | undefined;
    let keyString: string | undefined;
    
    for (const [key, value] of apiKeys.entries()) {
      if (value.id === keyId && value.userId === req.user.id) {
        keyToDelete = value;
        keyString = key;
        break;
      }
    }

    if (!keyToDelete || !keyString) {
      return res.status(404).json({ error: 'API key not found' });
    }

    apiKeys.delete(keyString);
    res.json({ message: 'API key deleted successfully' });
  });

  // User API
  app.get("/api/v1/user", authenticateAPI, requirePermission('read'), async (req: Request, res: Response) => {
    const user = req.user as APIUser;
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      companyId: user.companyId
    });
  });

  // Projects API
  app.get("/api/v1/projects", authenticateAPI, requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const projects = await storage.getAccessibleProjectsForUser(req.user.id);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.get("/api/v1/projects/:id", authenticateAPI, requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      const hasAccess = await permissionService.hasProjectAccess(req.user.id, projectId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this project' });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  app.post("/api/v1/projects", authenticateAPI, requirePermission('write'), async (req: Request, res: Response) => {
    try {
      const { title, description, assignedUserIds = [] } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: 'Project title is required' });
      }

      const newProject = await storage.createProject({
        title,
        description: description || null,
        creatorId: req.user.id,
        assignedUserIds
      });

      res.status(201).json(newProject);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  // Boards API
  app.get("/api/v1/boards", authenticateAPI, requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const boards = await storage.getAccessibleBoardsForUser(req.user.id);
      res.json(boards);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch boards' });
    }
  });

  app.get("/api/v1/boards/:id", authenticateAPI, requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const boardId = parseInt(req.params.id);
      const hasAccess = await permissionService.hasBoardAccess(req.user.id, boardId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this board' });
      }

      const board = await storage.getBoard(boardId);
      if (!board) {
        return res.status(404).json({ error: 'Board not found' });
      }

      res.json(board);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch board' });
    }
  });

  app.post("/api/v1/boards", authenticateAPI, requirePermission('write'), async (req: Request, res: Response) => {
    try {
      const { title, description, projectId, assignedUserIds = [] } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: 'Board title is required' });
      }

      // Prüfe Projektberechtigung falls projektbasiert
      if (projectId) {
        const hasAccess = await permissionService.hasProjectAccess(req.user.id, projectId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied to the specified project' });
        }
      }

      const newBoard = await storage.createBoard({
        title,
        description: description || null,
        projectId: projectId || null,
        creatorId: req.user.id,
        assignedUserIds
      });

      res.status(201).json(newBoard);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create board' });
    }
  });

  // Tasks API
  app.get("/api/v1/tasks", authenticateAPI, requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const { boardId, status, assignedTo } = req.query;
      let tasks;

      if (boardId) {
        const hasAccess = await permissionService.hasBoardAccess(req.user.id, parseInt(boardId as string));
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied to this board' });
        }
        tasks = await storage.getTasksByBoard(parseInt(boardId as string));
      } else {
        tasks = await storage.getAccessibleTasksForUser(req.user.id);
      }

      // Filter anwenden
      if (status) {
        tasks = tasks.filter(task => task.status === status);
      }
      if (assignedTo) {
        tasks = tasks.filter(task => task.assignedUserIds?.includes(parseInt(assignedTo as string)));
      }

      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.get("/api/v1/tasks/:id", authenticateAPI, requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const hasAccess = await permissionService.hasTaskAccess(req.user.id, taskId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this task' });
      }

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  app.post("/api/v1/tasks", authenticateAPI, requirePermission('write'), async (req: Request, res: Response) => {
    try {
      const { title, description, boardId, status = 'todo', assignedUserIds = [] } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: 'Task title is required' });
      }

      if (!boardId) {
        return res.status(400).json({ error: 'Board ID is required' });
      }

      // Prüfe Board-Berechtigung
      const hasAccess = await permissionService.hasBoardAccess(req.user.id, boardId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this board' });
      }

      const newTask = await storage.createTask({
        title,
        description: description || null,
        boardId,
        status,
        assignedUserIds,
        creatorId: req.user.id
      });

      res.status(201).json(newTask);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  app.patch("/api/v1/tasks/:id", authenticateAPI, requirePermission('write'), async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const hasAccess = await permissionService.hasTaskAccess(req.user.id, taskId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this task' });
      }

      const updateData = req.body;
      const updatedTask = await storage.updateTask(taskId, updateData);

      if (!updatedTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Comments API
  app.get("/api/v1/tasks/:taskId/comments", authenticateAPI, requirePermission('read'), async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const hasAccess = await permissionService.hasTaskAccess(req.user.id, taskId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this task' });
      }

      const comments = await storage.getCommentsByTask(taskId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  app.post("/api/v1/tasks/:taskId/comments", authenticateAPI, requirePermission('write'), async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const hasAccess = await permissionService.hasTaskAccess(req.user.id, taskId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this task' });
      }

      const newComment = await storage.createComment({
        content,
        taskId,
        userId: req.user.id
      });

      res.status(201).json(newComment);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  // API Documentation Endpoint
  app.get("/api/v1/docs", (req: Request, res: Response) => {
    res.json({
      name: "SuperOrga REST API",
      version: "1.0",
      description: "REST API für Drittanbieter-Integrationen",
      authentication: {
        type: "Bearer Token",
        header: "Authorization: Bearer YOUR_API_KEY"
      },
      endpoints: {
        "User Management": {
          "GET /api/v1/user": "Get current user information",
          "POST /api/v1/keys": "Create new API key",
          "GET /api/v1/keys": "List API keys",
          "DELETE /api/v1/keys/:id": "Delete API key"
        },
        "Projects": {
          "GET /api/v1/projects": "List accessible projects",
          "GET /api/v1/projects/:id": "Get project details",
          "POST /api/v1/projects": "Create new project"
        },
        "Boards": {
          "GET /api/v1/boards": "List accessible boards",
          "GET /api/v1/boards/:id": "Get board details",
          "POST /api/v1/boards": "Create new board"
        },
        "Tasks": {
          "GET /api/v1/tasks": "List tasks (with filters)",
          "GET /api/v1/tasks/:id": "Get task details",
          "POST /api/v1/tasks": "Create new task",
          "PATCH /api/v1/tasks/:id": "Update task"
        },
        "Comments": {
          "GET /api/v1/tasks/:taskId/comments": "Get task comments",
          "POST /api/v1/tasks/:taskId/comments": "Add comment to task"
        }
      },
      permissions: [
        "read - Read access to resources",
        "write - Create and update resources",
        "delete - Delete resources",
        "* - Full access (admin)"
      ]
    });
  });

  console.log('🔗 REST API routes registered successfully');
}

// Erweitere Request-Interface für TypeScript
declare global {
  namespace Express {
    interface Request {
      apiKey?: APIKey;
    }
  }
}