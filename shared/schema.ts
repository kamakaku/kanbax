import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(),
  order: integer("order").notNull(),
  boardId: integer("board_id").notNull(),
  priority: text("priority").notNull().default("medium"),
  labels: text("labels").array(),
  dueDate: timestamp("due_date"),
  archived: boolean("archived").default(false),
});

export const checklistItems = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
  itemOrder: integer("item_order").notNull(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  taskId: integer("task_id").notNull(),
  authorName: text("author_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Board schemas
export const insertBoardSchema = createInsertSchema(boards).pick({
  title: true,
  description: true,
});

// Task schemas
export const insertTaskSchema = createInsertSchema(tasks)
  .pick({
    title: true,
    description: true,
    status: true,
    order: true,
    boardId: true,
    priority: true,
    labels: true,
    dueDate: true,
    archived: true
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    status: z.enum(["todo", "in-progress", "done"]),
    boardId: z.number().int().positive("Board ID is required"),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    labels: z.array(z.string()).default([]),
    dueDate: z.string().nullable(),
    archived: z.boolean().default(false)
  });

// Checklist schemas
export const insertChecklistItemSchema = createInsertSchema(checklistItems)
  .pick({
    taskId: true,
    title: true,
    completed: true,
    itemOrder: true,
  })
  .extend({
    taskId: z.number().int().positive("Task ID is required"),
    title: z.string().min(1, "Title is required"),
    completed: z.boolean().default(false),
  });

// Comment schemas
export const insertCommentSchema = createInsertSchema(comments)
  .pick({
    content: true,
    taskId: true,
    authorName: true,
  })
  .extend({
    content: z.string().min(1, "Comment cannot be empty"),
    taskId: z.number().int().positive("Task ID is required"),
    authorName: z.string().min(1, "Author name is required"),
  });

// Activity Log schemas
export const insertActivityLogSchema = createInsertSchema(activityLogs)
  .pick({
    taskId: true,
    action: true,
    details: true,
  })
  .extend({
    taskId: z.number().int().positive("Task ID is required"),
    action: z.string().min(1, "Action is required"),
    details: z.string().optional(),
  });

// Export types
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const updateTaskSchema = insertTaskSchema.partial();
export type UpdateTask = z.infer<typeof updateTaskSchema>;

export const updateBoardSchema = insertBoardSchema.partial();
export type UpdateBoard = z.infer<typeof updateBoardSchema>;