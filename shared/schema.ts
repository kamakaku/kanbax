import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
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
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    status: z.enum(["todo", "in-progress", "done"]),
    boardId: z.number().int().positive("Board ID is required"),
  });

export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const updateTaskSchema = insertTaskSchema.partial();
export type UpdateTask = z.infer<typeof updateTaskSchema>;

export const updateBoardSchema = insertBoardSchema.partial();
export type UpdateBoard = z.infer<typeof updateBoardSchema>;