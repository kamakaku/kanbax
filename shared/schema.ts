import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
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
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  taskId: integer("task_id").notNull(),
  authorName: text("author_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBoardSchema = createInsertSchema(boards).pick({
  title: true,
  description: true,
});

export const insertTaskSchema = createInsertSchema(tasks)
  .pick({
    title: true,
    description: true,
    status: true,
    order: true,
    boardId: true,
    priority: true,
    labels: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    status: z.enum(["todo", "in-progress", "done"]),
    boardId: z.number().int().positive("Board ID is required"),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    labels: z.array(z.string()).default([]),
  });

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

export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export const updateTaskSchema = insertTaskSchema.partial();
export type UpdateTask = z.infer<typeof updateTaskSchema>;

export const updateBoardSchema = insertBoardSchema.partial();
export type UpdateBoard = z.infer<typeof updateBoardSchema>;