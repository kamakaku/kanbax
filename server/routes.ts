import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertTaskSchema, updateTaskSchema, insertBoardSchema, updateBoardSchema, insertCommentSchema, insertChecklistItemSchema, insertActivityLogSchema } from "@shared/schema";

export async function registerRoutes(app: Express) {
  // Board routes
  app.get("/api/boards", async (_req, res) => {
    const boards = await storage.getBoards();
    res.json(boards);
  });

  app.get("/api/boards/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
      const board = await storage.getBoard(id);
      res.json(board);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.post("/api/boards", async (req, res) => {
    const result = insertBoardSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }
    const board = await storage.createBoard(result.data);
    res.status(201).json(board);
  });

  app.patch("/api/boards/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    const result = updateBoardSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const board = await storage.updateBoard(id, result.data);
      res.json(board);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/boards/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid board ID" });
    }

    try {
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

    console.log("Received task creation request:", {
      body: req.body,
      boardId: boardId
    });

    const result = insertTaskSchema.safeParse({ ...req.body, boardId });
    if (!result.success) {
      console.error("Task validation failed:", result.error);
      return res.status(400).json({ 
        message: "Invalid task data",
        errors: result.error.errors 
      });
    }

    try {
      console.log("Validated task data:", result.data);
      const task = await storage.createTask(result.data);
      console.log("Created task:", task);
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
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const task = await storage.updateTask(id, result.data);
      res.json(task);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    try {
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

  return createServer(app);
}