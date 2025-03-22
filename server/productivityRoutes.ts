import type { Express, Request } from "express";
import { storage } from "./storage";
import { insertUserProductivityMetricsSchema, insertTaskTimeEntrySchema, insertTaskStateChangeSchema } from "@shared/schema";
import { subDays, startOfDay } from "date-fns";
import { requireAuth } from "./middleware/auth";

export function registerProductivityRoutes(app: Express) {
  // Get productivity metrics for a user
  app.get("/api/productivity/metrics/:userId", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const days = parseInt(req.query.days as string) || 7;

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const metrics = await storage.getUserProductivityMetrics(userId, days);

      // Fill in missing dates with zero values
      const filledMetrics = [];
      const endDate = new Date();
      let currentDate = subDays(endDate, days - 1);

      while (currentDate <= endDate) {
        const existingMetric = metrics.find(
          m => startOfDay(new Date(m.date)).getTime() === startOfDay(currentDate).getTime()
        );

        filledMetrics.push(
          existingMetric || {
            date: currentDate.toISOString(),
            tasksCompleted: 0,
            tasksCreated: 0,
            timeSpentMinutes: 0,
            objectivesAchieved: 0,
          }
        );

        currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
      }

      res.json(filledMetrics);
    } catch (error) {
      console.error("Failed to fetch productivity metrics:", error);
      res.status(500).json({ message: "Failed to fetch productivity metrics" });
    }
  });

  // Get task distribution for a user
  app.get("/api/productivity/task-distribution/:userId", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const distribution = await storage.getTaskDistribution(userId);
      res.json(distribution);
    } catch (error) {
      console.error("Failed to fetch task distribution:", error);
      res.status(500).json({ message: "Failed to fetch task distribution" });
    }
  });

  // Start time tracking for a task
  app.post("/api/productivity/time-entries", requireAuth, async (req, res) => {
    try {
      const result = insertTaskTimeEntrySchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error.message });
      }

      const timeEntry = await storage.createTaskTimeEntry(result.data);
      res.status(201).json(timeEntry);
    } catch (error) {
      console.error("Failed to create time entry:", error);
      res.status(500).json({ message: "Failed to create time entry" });
    }
  });

  // End time tracking for a task
  app.patch("/api/productivity/time-entries/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const endTime = new Date(req.body.endTime);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid time entry ID" });
      }

      if (isNaN(endTime.getTime())) {
        return res.status(400).json({ message: "Invalid end time" });
      }

      const timeEntry = await storage.updateTaskTimeEntry(id, endTime);
      res.json(timeEntry);
    } catch (error) {
      console.error("Failed to update time entry:", error);
      res.status(500).json({ message: "Failed to update time entry" });
    }
  });

  // Record a task state change
  app.post("/api/productivity/state-changes", requireAuth, async (req, res) => {
    try {
      const result = insertTaskStateChangeSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error.message });
      }

      const stateChange = await storage.createTaskStateChange(result.data);
      res.status(201).json(stateChange);
    } catch (error) {
      console.error("Failed to create state change:", error);
      res.status(500).json({ message: "Failed to create state change" });
    }
  });
}
