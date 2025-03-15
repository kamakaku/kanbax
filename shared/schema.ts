import { pgTable, text, serial, integer, timestamp, boolean, real } from "drizzle-orm/pg-core";
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

// Update boards table to include projectId
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  projectId: integer("project_id"), // Remove .notNull()
  memberIds: integer("member_ids").array().default([]),
  teamIds: integer("team_ids").array().default([]),
  guestEmails: text("guest_emails").array().default([]),
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
  checklist: text("checklist").array(), // Keep as text array, but store stringified objects
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
    projectId: z.number().int().positive("Project ID must be positive").optional(),
    memberIds: z.array(z.number().int().positive()).optional(),
    teamIds: z.array(z.number().int().positive()).optional(),
    guestEmails: z.array(z.string().email()).optional(),
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
    checklist: z.array(z.string()).default([]), // Accept stringified objects
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

// OKR Cycles Tabelle
export const okrCycles = pgTable("okr_cycles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("active"), // active, completed, archived
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema für das Einfügen eines neuen OKR-Zyklus
export const insertOkrCycleSchema = createInsertSchema(okrCycles)
  .pick({
    title: true,
    startDate: true,
    endDate: true,
    status: true,
  })
  .extend({
    title: z.string().min(1, "Titel ist erforderlich"),
    startDate: z.string().min(1, "Startdatum ist erforderlich"),
    endDate: z.string().min(1, "Enddatum ist erforderlich"),
    status: z.enum(["active", "completed", "archived"]).default("active"),
  });

// Export des OKR-Zyklus-Typs
export type OkrCycle = typeof okrCycles.$inferSelect;
export type InsertOkrCycle = z.infer<typeof insertOkrCycleSchema>;

// Objectives are now independent entities
export const objectives = pgTable("objectives", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active, completed, archived
  progress: real("progress").default(0),
  // Optional associations
  projectId: integer("project_id"),
  cycleId: integer("cycle_id"),
  teamId: integer("team_id"),
  userId: integer("user_id"),
  userIds: integer("user_ids").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Key Results with task linkage
export const keyResults = pgTable("key_results", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  objectiveId: integer("objective_id").notNull(),
  type: text("type").notNull(), // percentage, checkbox, progress, checklist
  targetValue: real("target_value").notNull(),
  currentValue: real("current_value").default(0),
  progress: real("progress").default(0),
  linkedTaskIds: integer("linked_task_ids").array(),
  status: text("status").notNull().default("active"), // active, completed, archived
  checklistItems: text("checklist_items").array(), // Store JSON stringified checklist items
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Update the insertKeyResultSchema to include checklist items
export const insertKeyResultSchema = createInsertSchema(keyResults)
  .pick({
    title: true,
    description: true,
    objectiveId: true,
    type: true,
    targetValue: true,
    currentValue: true,
    linkedTaskIds: true,
    status: true,
    checklistItems: true,
  })
  .extend({
    title: z.string().min(1, "Titel ist erforderlich"),
    objectiveId: z.number().int().positive("Objective ID ist erforderlich"),
    type: z.enum(["percentage", "checkbox", "progress", "checklist"]),
    targetValue: z.number().min(0),
    currentValue: z.number().min(0).optional(),
    linkedTaskIds: z.array(z.number()).optional(),
    status: z.enum(["active", "completed", "archived"]).default("active"),
    checklistItems: z.array(z.object({
      title: z.string(),
      completed: z.boolean().default(false)
    })).optional(),
  });

// Comments can be attached to either objectives or key results
export const okrComments = pgTable("okr_comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull(),
  objectiveId: integer("objective_id"),
  keyResultId: integer("key_result_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Updated schemas to reflect the new structure

export const insertObjectiveSchema = createInsertSchema(objectives)
  .pick({
    title: true,
    description: true,
    projectId: true,
    cycleId: true,
    teamId: true,
    userId: true,
    userIds: true,
    status: true,
  })
  .extend({
    title: z.string().min(1, "Titel ist erforderlich"),
    projectId: z.number().int().positive().optional(),
    cycleId: z.number().int().positive().optional(),
    teamId: z.number().int().positive().optional(),
    userId: z.number().int().positive().optional(),
    userIds: z.array(z.number().int().positive()).optional(),
    status: z.enum(["active", "completed", "archived"]).default("active"),
  });


export const insertOkrCommentSchema = createInsertSchema(okrComments)
  .pick({
    content: true,
    authorId: true,
    objectiveId: true,
    keyResultId: true,
  })
  .extend({
    content: z.string().min(1, "Kommentar kann nicht leer sein"),
    authorId: z.number().int().positive("Autor ID ist erforderlich"),
    objectiveId: z.number().int().positive().optional(),
    keyResultId: z.number().int().positive().optional(),
  });

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;
export type InsertColumn = z.infer<typeof insertColumnSchema>;
export type Column = typeof columns.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect & {
  checklist: string[]; // Store as string array
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

export type Objective = typeof objectives.$inferSelect;
export type InsertObjective = z.infer<typeof insertObjectiveSchema>;

export type KeyResult = typeof keyResults.$inferSelect;
export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;

export type OkrComment = typeof okrComments.$inferSelect;
export type InsertOkrComment = z.infer<typeof insertOkrCommentSchema>;

// Add new tables for board permissions after the existing tables
export const boardMembers = pgTable("board_members", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"), // 'member', 'admin', or 'guest'
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
});

export const boardTeams = pgTable("board_teams", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull(),
  teamId: integer("team_id").notNull(),
  role: text("role").notNull().default("member"), // 'member' or 'admin'
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Add schemas for the new tables
export const insertBoardMemberSchema = createInsertSchema(boardMembers)
  .pick({
    boardId: true,
    userId: true,
    role: true,
  })
  .extend({
    role: z.enum(["member", "admin", "guest"]).default("member"),
  });

export const insertBoardTeamSchema = createInsertSchema(boardTeams)
  .pick({
    boardId: true,
    teamId: true,
    role: true,
  })
  .extend({
    role: z.enum(["member", "admin"]).default("member"),
  });

// Export types for the new tables
export type BoardMember = typeof boardMembers.$inferSelect;
export type InsertBoardMember = z.infer<typeof insertBoardMemberSchema>;
export type BoardTeam = typeof boardTeams.$inferSelect;
export type InsertBoardTeam = z.infer<typeof insertBoardTeamSchema>;


// Add new tables for productivity insights after the existing tables

// Track user activity and productivity metrics
export const userProductivityMetrics = pgTable("user_productivity_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: timestamp("date").notNull(),
  tasksCompleted: integer("tasks_completed").default(0),
  tasksCreated: integer("tasks_created").default(0),
  timeSpentMinutes: integer("time_spent_minutes").default(0),
  objectivesAchieved: integer("objectives_achieved").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track time spent on tasks
export const taskTimeEntries = pgTable("task_time_entries", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track task state changes for analytics
export const taskStateChanges = pgTable("task_state_changes", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// Add schemas for the new tables
export const insertUserProductivityMetricsSchema = createInsertSchema(userProductivityMetrics)
  .pick({
    userId: true,
    date: true,
    tasksCompleted: true,
    tasksCreated: true,
    timeSpentMinutes: true,
    objectivesAchieved: true,
  })
  .extend({
    userId: z.number().int().positive("User ID is required"),
    date: z.string().min(1, "Date is required"),
  });

export const insertTaskTimeEntrySchema = createInsertSchema(taskTimeEntries)
  .pick({
    taskId: true,
    userId: true,
    startTime: true,
    endTime: true,
    durationMinutes: true,
  })
  .extend({
    taskId: z.number().int().positive("Task ID is required"),
    userId: z.number().int().positive("User ID is required"),
    startTime: z.string().min(1, "Start time is required"),
  });

export const insertTaskStateChangeSchema = createInsertSchema(taskStateChanges)
  .pick({
    taskId: true,
    userId: true,
    fromState: true,
    toState: true,
  })
  .extend({
    taskId: z.number().int().positive("Task ID is required"),
    userId: z.number().int().positive("User ID is required"),
    fromState: z.string().min(1, "Previous state is required"),
    toState: z.string().min(1, "New state is required"),
  });

// Export types for the new tables
export type UserProductivityMetrics = typeof userProductivityMetrics.$inferSelect;
export type InsertUserProductivityMetrics = z.infer<typeof insertUserProductivityMetricsSchema>;

export type TaskTimeEntry = typeof taskTimeEntries.$inferSelect;
export type InsertTaskTimeEntry = z.infer<typeof insertTaskTimeEntrySchema>;

export type TaskStateChange = typeof taskStateChanges.$inferSelect;
export type InsertTaskStateChange = z.infer<typeof insertTaskStateChangeSchema>;