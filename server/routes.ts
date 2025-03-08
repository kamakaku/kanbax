import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertTaskSchema, updateTaskSchema, insertBoardSchema, updateBoardSchema } from "@shared/schema";

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

  return createServer(app);
}