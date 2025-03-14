import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table with avatar support
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add new table for teams
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"), // 'member' or 'admin'
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Wiki articles table
export const wikiArticles = pgTable("wiki_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  projectId: integer("project_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Update boards table to include projectId
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  projectId: integer("project_id").notNull(),
});

export const columns = pgTable("columns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  boardId: integer("board_id").notNull(),
  order: integer("order").notNull(),
});

// Update tasks table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(),
  order: integer("order").notNull(),
  boardId: integer("board_id").notNull(),
  columnId: integer("column_id").notNull(),
  priority: text("priority").notNull().default("medium"),
  labels: text("labels").array(),
  dueDate: text("due_date"), // Store as ISO string
  archived: boolean("archived").default(false),
  assignedUserIds: integer("assigned_user_ids").array(),
  assignedTeamId: integer("assigned_team_id"),
  assignedAt: timestamp("assigned_at"),
  checklist: text("checklist").array(), // Keep as text array for now to avoid migration issues
});

export const checklistItems = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
  itemOrder: integer("item_order").notNull(),
});

// Update the comments table definition to include rich text
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  rawContent: text("raw_content").notNull(), // Store raw content for the editor
  taskId: integer("task_id").notNull(),
  authorId: integer("author_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const checklistItemSchema = z.object({
  text: z.string().min(1, "Text is required"),
  checked: z.boolean().default(false),
});

export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    email: true,
    passwordHash: true,
  })
  .extend({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .omit({ passwordHash: true });

// Update project schema
export const insertProjectSchema = createInsertSchema(projects)
  .pick({
    title: true,
    description: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
  });

export const updateProjectSchema = insertProjectSchema.partial();

// Update board schema
export const insertBoardSchema = createInsertSchema(boards)
  .pick({
    title: true,
    description: true,
    projectId: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    projectId: z.number().int().positive("Project ID is required"),
  });

export const insertColumnSchema = createInsertSchema(columns)
  .pick({
    title: true,
    boardId: true,
    order: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    boardId: z.number().int().positive("Board ID is required"),
  });

// Update insert task schema
export const insertTaskSchema = createInsertSchema(tasks)
  .pick({
    title: true,
    description: true,
    status: true,
    order: true,
    boardId: true,
    columnId: true,
    priority: true,
    labels: true,
    dueDate: true,
    archived: true,
    assignedUserIds: true,
    assignedTeamId: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    status: z.enum(["backlog", "todo", "in-progress", "review", "done"]),
    boardId: z.number().int().positive("Board ID is required"),
    columnId: z.number().int(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    labels: z.array(z.string()).default([]),
    dueDate: z.string().nullable().optional(), // Accept ISO string or null
    checklist: z.array(z.string()).default([]), // Store as strings for now
    archived: z.boolean().default(false),
    assignedUserIds: z.array(z.number().int().positive()).default([]),
    assignedTeamId: z.union([
      z.number().int().positive("Team ID must be positive if provided"),
      z.null()
    ]).optional().nullable(),
  });

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

// Update the comment schema
export const insertCommentSchema = createInsertSchema(comments)
  .pick({
    content: true,
    rawContent: true,
    taskId: true,
    authorId: true,
  })
  .extend({
    content: z.string().min(1, "Comment cannot be empty"),
    rawContent: z.string().min(1, "Raw content cannot be empty"),
    taskId: z.number().int().positive("Task ID is required"),
    authorId: z.number().int().positive("Author ID is required"),
  });

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

// Add team schemas
export const insertTeamSchema = createInsertSchema(teams)
  .pick({
    name: true,
    description: true,
  })
  .extend({
    name: z.string().min(1, "Team name is required"),
  });

export const insertTeamMemberSchema = createInsertSchema(teamMembers)
  .pick({
    teamId: true,
    userId: true,
    role: true,
  })
  .extend({
    role: z.enum(["member", "admin"]).default("member"),
  });

// Add project types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;
export type InsertColumn = z.infer<typeof insertColumnSchema>;
export type Column = typeof columns.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect & {
  checklist: string[]; // Keep as string array for database compatibility
  assignedUser?: {
    id: number;
    username: string;
    email: string;
  } | null;
  assignedTeam?: {
    id: number;
    name: string;
    description: string | null;
  } | null;
};
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;
// Update the comment type
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const updateTaskSchema = insertTaskSchema.partial();
export type UpdateTask = z.infer<typeof updateTaskSchema>;

export const updateBoardSchema = insertBoardSchema.partial();
export type UpdateBoard = z.infer<typeof updateBoardSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

// Add project types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

// Wiki article schema
export const insertWikiArticleSchema = createInsertSchema(wikiArticles)
  .pick({
    title: true,
    content: true,
    projectId: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    projectId: z.number().int().positive("Project ID is required"),
  });

export const updateWikiArticleSchema = insertWikiArticleSchema.partial();

// Export types
export type WikiArticle = typeof wikiArticles.$inferSelect;
export type InsertWikiArticle = z.infer<typeof insertWikiArticleSchema>;
export type UpdateWikiArticle = z.infer<typeof updateWikiArticleSchema>;