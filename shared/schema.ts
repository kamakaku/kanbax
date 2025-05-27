import { pgTable, text, serial, integer, timestamp, boolean, primaryKey, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  inviteCode: text("invite_code").notNull().unique(), // Einladungscode für das Unternehmen
  isPaused: boolean("is_paused").default(false).notNull(), // Ob das Unternehmen pausiert ist
  pauseReason: text("pause_reason"), // Begründung für die Pausierung
  pausedAt: timestamp("paused_at"), // Zeitpunkt der Pausierung
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User table with avatar support, company association, activation and subscription
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  companyId: integer("company_id").references(() => companies.id),
  isCompanyAdmin: boolean("is_company_admin").default(false),
  isHyperAdmin: boolean("is_hyper_admin").default(false), // Hyper-Admin für die gesamte SaaS-Plattform
  isActive: boolean("is_active").default(false), // Benutzer muss von einem Admin aktiviert werden
  isPaused: boolean("is_paused").default(false).notNull(), // Ob der Benutzer pausiert ist
  pauseReason: text("pause_reason"), // Begründung für die Pausierung
  pausedAt: timestamp("paused_at"), // Zeitpunkt der Pausierung
  lastLoginAt: timestamp("last_login_at"),
  subscriptionTier: text("subscription_tier").default("free"), // free, basic, premium, enterprise
  subscriptionBillingCycle: text("subscription_billing_cycle").default("monthly"), // monthly, yearly
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Add new table for teams with company association
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  companyId: integer("company_id").notNull().references(() => companies.id),
  creatorId: integer("creator_id").notNull(),
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
  teamIds: integer("team_ids").array().default([]),
  memberIds: integer("member_ids").array().default([]),
  isFavorite: boolean("is_favorite").default(false),
  archived: boolean("archived").default(false),
  companyId: integer("company_id").references(() => companies.id),
  creator_id: integer("creator_id").notNull().default(1), // Default für existierende Einträge
});

// Update boards table definition
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  richDescription: text("rich_description"),  // Rich text description
  project_id: integer("project_id"),
  creator_id: integer("creator_id").notNull(),
  team_ids: integer("team_ids").array().default([]).notNull(),
  assigned_user_ids: integer("assigned_user_ids").array().default([]).notNull(),
  is_favorite: boolean("is_favorite").default(false),
  archived: boolean("archived").default(false),
  attachments: text("attachments").array(), // Array of file paths/urls
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
  richDescription: text("rich_description"),  // Rich text description
  status: text("status").notNull(),
  order: integer("order").notNull(),
  boardId: integer("board_id").notNull(),  // Bleibt .notNull() für Kompatibilität mit bestehenden Daten
  columnId: integer("column_id"),
  priority: text("priority").notNull().default("medium"),
  labels: text("labels").array(),
  startDate: text("start_date"), // Store as ISO string for start date
  dueDate: text("due_date"), // Store as ISO string for due date
  archived: boolean("archived").default(false),
  assignedUserIds: integer("assigned_user_ids").array(),
  assignedTeamId: integer("assigned_team_id"),
  assignedAt: timestamp("assigned_at"),
  checklist: text("checklist").array(), // Keep as text array, but store stringified objects
  attachments: text("attachments").array(), // Array of file paths/urls
  // Wir kommentieren die company_id aus, da die Migration noch nicht durchgeführt wurde
  // company_id: integer("company_id").references(() => companies.id), // Referenz zum Unternehmen
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

// Update the activity_logs table definition
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // 'create', 'update', 'delete', 'assign', 'mention', 'comment', 'approval'
  details: text("details"),
  userId: integer("user_id").references(() => users.id),
  boardId: integer("board_id").references(() => boards.id),
  projectId: integer("project_id").references(() => projects.id),
  objectiveId: integer("objective_id").references(() => objectives.id),
  taskId: integer("task_id").references(() => tasks.id),
  commentId: integer("comment_id").references(() => comments.id),
  teamId: integer("team_id").references(() => teams.id),
  targetUserId: integer("target_user_id").references(() => users.id), // Empfänger der Aktivität
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Sichtbarkeitskontrolle
  visibleToTeams: integer("visible_to_teams").array(),
  visibleToUsers: integer("visible_to_users").array(),
  requiresNotification: boolean("requires_notification").default(false),
  notificationSent: boolean("notification_sent").default(false),
  notificationType: text("notification_type"), // Spezifischer Benachrichtigungstyp
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
    companyId: true,
    isActive: true,
  })
  .extend({
    username: z.string().min(3, "Benutzername muss mindestens 3 Zeichen lang sein"),
    email: z.string().email("Ungültige E-Mail-Adresse"),
    password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
    inviteCode: z.union([
      z.string().min(6, "Einladungscode muss mindestens 6 Zeichen lang sein"),
      z.string().length(0),
      z.undefined(),
      z.null()
    ]).optional(),
    isActive: z.boolean().default(false),
  })
  .omit({ passwordHash: true, companyId: true });

// Update project schema
export const insertProjectSchema = createInsertSchema(projects)
  .pick({
    title: true,
    description: true,
    companyId: true,
    creator_id: true,
    archived: true,
  })
  .extend({
    title: z.string().min(1, "Titel ist erforderlich"),
    description: z.string().optional(),
    companyId: z.union([
      z.number().int().positive("Unternehmens-ID muss eine positive Zahl sein"), 
      z.null()
    ]).optional(), // Erlaubt null für companyId
    teamIds: z.array(z.number().int().positive()).optional(),
    memberIds: z.array(z.number().int().positive()).optional(),
    creator_id: z.number().int().positive("Creator ID ist erforderlich"),
    archived: z.boolean().default(false),
  });

export const updateProjectSchema = insertProjectSchema.partial();

// Update board schema
export const insertBoardSchema = createInsertSchema(boards)
  .pick({
    title: true,
    description: true,
    project_id: true,
    creator_id: true,
    team_ids: true,
    assigned_user_ids: true,
    is_favorite: true,
    archived: true,
  })
  .extend({
    title: z.string().min(1, "Titel ist erforderlich"),
    description: z.string().nullable().optional(),
    project_id: z.number().int().positive("Projekt ID muss positiv sein").nullable().optional(),
    creator_id: z.number().int().positive("Creator ID ist erforderlich").default(0),
    team_ids: z.preprocess(
      (val) => (Array.isArray(val) ? val : []).filter(Boolean).map(Number),
      z.array(z.number().int().positive("Team ID muss eine positive Zahl sein"))
    ).default([]),
    assigned_user_ids: z.preprocess(
      (val) => (Array.isArray(val) ? val : []).filter(Boolean).map(Number),
      z.array(z.number().int().positive("Benutzer ID muss eine positive Zahl sein"))
    ).default([]),
    is_favorite: z.boolean().default(false),
    archived: z.boolean().default(false),
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
    richDescription: true,
    status: true,
    order: true,
    boardId: true,
    columnId: true,
    priority: true,
    labels: true,
    startDate: true,
    dueDate: true,
    archived: true,
    assignedUserIds: true,
    assignedTeamId: true,
    checklist: true,
    attachments: true,
  })
  .extend({
    title: z.string().min(1, "Title is required"),
    status: z.enum(["backlog", "todo", "in-progress", "review", "done"]),
    // Erlaubt null, undefined oder positive Zahlen für persönliche Aufgaben
    boardId: z.union([
      z.number().int().positive("Board ID must be a positive integer if provided"),
      z.null(),
      z.undefined()
    ]).optional(),
    // Erlaubt null, undefined oder positive Zahlen für persönliche Aufgaben
    columnId: z.union([
      z.number().int().positive("Column ID must be a positive integer if provided"),
      z.null(),
      z.undefined()
    ]).optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    labels: z.array(z.string()).default([]),
    startDate: z.string().nullable().optional(), // Accept ISO string or null for start date
    dueDate: z.string().nullable().optional(), // Accept ISO string or null for due date
    checklist: z.array(z.string()).default([]), // Accept stringified objects
    archived: z.boolean().default(false),
    assignedUserIds: z.array(z.number().int().positive()).default([]),
    assignedTeamId: z.union([
      z.number().int().positive("Team ID must be positive if provided"),
      z.null()
    ]).optional().nullable(),
    // Dateianlagen
    attachments: z.array(z.string()).optional().nullable(),
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

// Update the insert schema
export const insertActivityLogSchema = createInsertSchema(activityLogs)
  .pick({
    action: true,
    details: true,
    userId: true,
    boardId: true,
    projectId: true,
    objectiveId: true,
    taskId: true,
    commentId: true,
    teamId: true,
    targetUserId: true,
    visibleToTeams: true,
    visibleToUsers: true,
    requiresNotification: true,
    notificationSent: true,
    notificationType: true
  })
  .extend({
    action: z.enum(["create", "update", "delete", "assign", "mention", "comment", "approval"]),
    details: z.string().optional(),
    userId: z.number().int().positive().optional(),
    boardId: z.number().int().positive().optional(),
    projectId: z.number().int().positive().optional(),
    objectiveId: z.number().int().positive().optional(),
    taskId: z.number().int().positive().optional(),
    commentId: z.number().int().positive().optional(),
    teamId: z.number().int().positive().optional(),
    targetUserId: z.number().int().positive().optional(),
    visibleToTeams: z.array(z.number().int().positive()).optional(),
    visibleToUsers: z.array(z.number().int().positive()).optional(),
    requiresNotification: z.boolean().default(false),
    notificationSent: z.boolean().default(false),
    notificationType: z.enum(["task", "board", "project", "team", "okr", "approval", "mention", "assignment"]).optional()
  });

// Add team schemas
export const insertTeamSchema = createInsertSchema(teams)
  .pick({
    name: true,
    description: true,
    companyId: true,
    creatorId: true,
  })
  .extend({
    name: z.string().min(1, "Team name is required"),
    description: z.string().optional(),
    companyId: z.number().int().positive("Company ID ist erforderlich"),
    creatorId: z.number().int().positive("Creator ID ist erforderlich"),
    member_ids: z.array(z.string()).optional(), // Changed from memberIds to member_ids
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
  richDescription: text("rich_description"),  // Rich text description
  status: text("status").notNull().default("active"),
  isFavorite: boolean("is_favorite").default(false),
  progress: integer("progress").default(0),
  // Optional associations
  projectId: integer("project_id"),
  cycleId: integer("cycle_id"),
  teamId: integer("team_id"),
  userId: integer("user_id"),
  userIds: integer("user_ids").array(),
  creatorId: integer("creator_id").notNull(), // Add creatorId field
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  attachments: text("attachments").array(), // Array of file paths/urls
});

// Key Results with task linkage
export const keyResults = pgTable("key_results", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  richDescription: text("rich_description"),  // Rich text description
  objectiveId: integer("objective_id").notNull(),
  type: text("type").notNull(), // percentage, checkbox, progress, checklist
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").default(0),
  progress: integer("progress").default(0),
  linkedTaskIds: integer("linked_task_ids").array(),
  status: text("status").notNull().default("active"), // active, completed, archived
  checklistItems: text("checklist_items").array(), // Store JSON stringified checklist items
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  attachments: text("attachments").array(), // Array of file paths/urls
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
  richContent: text("rich_content"), // Rich text content
  authorId: integer("author_id").notNull(),
  objectiveId: integer("objective_id"),
  keyResultId: integer("key_result_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  attachments: text("attachments").array(), // Array of file paths/urls
});

// Update the insert schema
export const insertOkrCommentSchema = createInsertSchema(okrComments)
  .pick({
    content: true,
    authorId: true,
    objectiveId: true,
    keyResultId: true,
  })
  .extend({
    content: z.string().min(1, "Comment content is required"),
    authorId: z.number().int().positive("Author ID is required"),
    objectiveId: z.number().int().positive().optional(),
    keyResultId: z.number().int().positive().optional(),
  });

// Update the insertObjectiveSchema
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
    creatorId: true,
  })
  .extend({
    title: z.string().min(1, "Titel ist erforderlich"),
    projectId: z.number().int().positive().optional(),
    cycleId: z.number().int().positive().optional(),
    teamId: z.number().int().positive().optional(),
    userId: z.number().int().positive().optional(),
    userIds: z.array(z.number().int().positive()).optional(),
    status: z.enum(["active", "completed", "archived"]).default("active"),
    creatorId: z.number().int().positive("Creator ID ist erforderlich"),
  });

// Export company schema
export const insertCompanySchema = createInsertSchema(companies)
  .pick({
    name: true,
    description: true,
    inviteCode: true,
  })
  .extend({
    name: z.string().min(1, "Unternehmensname ist erforderlich"),
    inviteCode: z.string().min(6, "Einladungscode muss mindestens 6 Zeichen haben"),
    description: z.string().optional(),
  });

// Export types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

// Erweitert den Typ für null-Rückgabe
export type CompanyResponse = Company | null;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
// Update Board type definition
export type Board = typeof boards.$inferSelect & {
  project?: {
    id: number;
    title: string;
  } | null;
  teams?: {
    id: number;
    name: string;
    description: string | null;
  }[];
  assignedUsers?: {
    id: number;
    username: string;
    email: string;
    avatarUrl: string | null;
  }[];
  created_at?: Date | string; // Hinzugefügt für Kompatibilität
};
export type InsertBoard = z.infer<typeof insertBoardSchema>;
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
  assignedUsers?: {
    id: number;
    username: string;
    avatarUrl: string | null;
  }[];
  columnId?: number | null; // Optional Spalten-ID
  boardId?: number | null; // Optional Board-ID
  board?: {
    id: number;
    title: string;
    projectId?: number | null;
  } | null;
  column?: {
    id: number;
    title: string;
  } | null;
  project?: {
    id: number;
    title: string;
  } | null;
  created_at?: Date | string; // Für Kompatibilität mit API-Antworten
  createdAt?: Date | string; // Drizzle-Feld
  isPersonal?: boolean; // Flag für persönliche Aufgaben (boardId === null)
};
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
// Update the ActivityLog type
export type ActivityLog = typeof activityLogs.$inferSelect & {
  board_title?: string;
  project_title?: string;
  objective_title?: string;
  task_title?: string;
  team_title?: string;
  comment_content?: string;
  username?: string;
  avatar_url?: string;
  target_username?: string;
};

export const updateTaskSchema = insertTaskSchema.partial();
export type UpdateTask = z.infer<typeof updateTaskSchema>;

// Update board schema
export const updateBoardSchema = createInsertSchema(boards)
  .pick({
    title: true,
    description: true,
    project_id: true,
    team_ids: true,
    assigned_user_ids: true,
    is_favorite: true,
    archived: true,
  })
  .extend({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    project_id: z.number().int().positive().nullable().optional(),
    team_ids: z.array(z.number().int()).default([]),
    assigned_user_ids: z.array(z.number().int()).default([]),
    is_favorite: z.boolean().optional(),
    archived: z.boolean().optional(),
  });
export type UpdateBoard = z.infer<typeof updateBoardSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

// Add project types
export type Project = typeof projects.$inferSelect & {
  teams?: {
    id: number;
    name: string;
    role: string;
  }[];
  members?: {
    id: number;
    username: string;
    email: string;
    avatarUrl: string | null;
  }[];
  creator?: {
    id: number;
    username: string;
    email: string;
    avatarUrl: string | null;
  } | null;
};
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

export type Objective = typeof objectives.$inferSelect & {
  cycle?: {
    id: number;
    title: string;
    startDate: Date;
    endDate: Date;
    status: string;
  } | null;
};
export type InsertObjective = z.infer<typeof insertObjectiveSchema>;

// Erweitere KeyResult um einen benutzerdefinierten Typ, der eine bessere
// Typisierung für Frontend und Backend bietet
export type KeyResult = typeof keyResults.$inferSelect & {
  // Für die Anzeige im Frontend: Geparstes Array von ChecklistItem-Objekten
  checklistItems?: Array<{ title: string; completed: boolean } | string>;
};
export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;

export type OkrComment = typeof okrComments.$inferSelect;
export type InsertOkrComment = z.infer<typeof insertOkrCommentSchema>;

// Add new tables for board permissions after the existing tables
export const boardMembers = pgTable("board_members", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boards.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"), // 'member', 'admin', or 'guest'
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
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

// Export types for the new tables
export type BoardMember = typeof boardMembers.$inferSelect;
export type InsertBoardMember = z.infer<typeof insertBoardMemberSchema>;


// Add new table for OKR permissions after existing tables
export const objectiveMembers = pgTable("objective_members", {
  id: serial("id").primaryKey(),
  objectiveId: integer("objective_id").notNull().references(() => objectives.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"), // 'member', 'admin', 'guest'
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
});

// Add schema for the new table
export const insertObjectiveMemberSchema = createInsertSchema(objectiveMembers)
  .pick({
    objectiveId: true,
    userId: true,
    role: true,
  })
  .extend({
    role: z.enum(["member", "admin", "guest"]).default("member"),
  });

// Export types for the new table
export type ObjectiveMember = typeof objectiveMembers.$inferSelect;
export type InsertObjectiveMember = z.infer<typeof insertObjectiveMemberSchema>;

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

// Add new table for project-team relationships after the existing tables
export const projectTeams = pgTable("project_teams", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  teamId: integer("team_id").notNull(),
  role: text("role").notNull().default("member"), // 'member' or 'admin'
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Add schema for the new table
export const insertProjectTeamSchema= createInsertSchema(projectTeams)
  .pick({
    projectId: true,
    teamId: true,
    role: true,
  })
  .extend({
    role: z.enum(["member", "admin"]).default("member"),
  });

// Export types for the new table
export type ProjectTeam = typeof projectTeams.$inferSelect;
export type InsertProjectTeam = z.infer<typeof insertProjectTeamSchema>;

// Add notification tables after the existing tables
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'task', 'board', 'project', 'team', 'okr'
  read: boolean("read").default(false),
  link: text("link"), // URL to the related content
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  // Aufgaben
  taskAssigned: boolean("task_assigned").default(true),
  taskDue: boolean("task_due").default(true),
  taskUpdates: boolean("task_updates").default(true),
  taskComments: boolean("task_comments").default(true),
  // Boards
  boardInvite: boolean("board_invite").default(true),
  boardUpdates: boolean("board_updates").default(true),
  // Teams
  teamInvite: boolean("team_invite").default(true),
  teamUpdates: boolean("team_updates").default(true),
  // Projekte
  projectUpdate: boolean("project_update").default(true),
  // OKRs
  okrProgress: boolean("okr_progress").default(true),
  okrComments: boolean("okr_comments").default(true),
  // Allgemein
  mentions: boolean("mentions").default(true),
  //Meeting Protokolle
  protocolUpdates: boolean("protocol_updates").default(true),
});

// Add schemas for the new tables
export const insertNotificationSchema = createInsertSchema(notifications)
  .pick({
    userId: true,
    title: true,
    message: true,
    type: true,
    link: true,
  })
  .extend({
    type: z.enum([
      // Aufgaben
      "task", "task_update", "task_delete", "task_comment",
      // Boards
      "board", "board_update", 
      // Projekte
      "project", "project_update",
      // Teams 
      "team", "team_update",
      // OKRs
      "okr", "okr_update", "okr_delete", "okr_comment",
      // Allgemein
      "approval", "mention", "assignment", "comment", "protocol"
    ]),
  });

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings)
  .pick({
    userId: true,
    // Aufgaben
    taskAssigned: true,
    taskDue: true,
    taskUpdates: true,
    taskComments: true,
    // Boards
    boardInvite: true,
    boardUpdates: true,
    // Teams
    teamInvite: true,
    teamUpdates: true,
    // Projekte
    projectUpdate: true,
    // OKRs
    okrProgress: true,
    okrComments: true,
    // Allgemein
    mentions: true,
    //Meeting Protokolle
    protocolUpdates: true,
  });

// Export types for the new tables
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;

// User favorite tables for personalized favorites
export const userFavoriteProjects = pgTable("user_favorite_projects", {
  userId: integer("user_id").notNull(),
  projectId: integer("project_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.projectId] })
  };
});

export const userFavoriteBoards = pgTable("user_favorite_boards", {
  userId: integer("user_id").notNull(),
  boardId: integer("board_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.boardId] })
  };
});

export const userFavoriteObjectives = pgTable("user_favorite_objectives", {
  userId: integer("user_id").notNull(),
  objectiveId: integer("objective_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.objectiveId] })
  };
});

// Meeting-Protokoll Tabelle für Teams und Projekte
export const meetingProtocols = pgTable("meeting_protocols", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date: timestamp("date").notNull(), // Datum des Meetings
  teamId: integer("team_id").references(() => teams.id),
  projectId: integer("project_id").references(() => projects.id),
  objectiveId: integer("objective_id").references(() => objectives.id),
  creatorId: integer("creator_id").notNull().references(() => users.id), // Ersteller des Protokolls
  agenda: text("agenda"), // Tagesordnung (Legacy-Feld, wird für ältere Protokolle beibehalten)
  decisions: text("decisions"), // Getroffene Entscheidungen (Legacy-Feld)
  agendaItems: jsonb("agenda_items"), // Strukturierte Agenda-Punkte mit Beschlüssen/Kategorien/Zuordnungen
  participants: text("participants").array(), // Teilnehmer als Array von User-IDs
  teamParticipants: integer("team_participants").array(), // Teilnehmende Teams als Array von Team-IDs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create insert schema for meeting protocols
export const insertMeetingProtocolSchema = createInsertSchema(meetingProtocols)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Export types for favorite tables
export type UserFavoriteProject = typeof userFavoriteProjects.$inferSelect;
export type UserFavoriteBoard = typeof userFavoriteBoards.$inferSelect;
export type UserFavoriteObjective = typeof userFavoriteObjectives.$inferSelect;

// Export types for meeting protocols
export type MeetingProtocol = typeof meetingProtocols.$inferSelect;
export type InsertMeetingProtocol = z.infer<typeof insertMeetingProtocolSchema>;

type NotificationSetting = {
  tasks: boolean;
  boards: boolean;
  projects: boolean;
  teams: boolean;
  okrs: boolean;
  protocols: boolean;
  mentions: boolean;
  assignments: boolean;
};

// Subscription Packages Table - defines available subscription plans and their limits
export const subscriptionPackages = pgTable("subscription_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // free, freelancer, organisation, enterprise, kanbax
  displayName: text("display_name").notNull(), // Display name for UI (e.g., "Kostenlos", "Freelancer", etc.)
  description: text("description").notNull(),
  price: integer("price").notNull(), // Price in cents/month
  maxProjects: integer("max_projects").notNull(), // Max number of projects allowed
  maxBoards: integer("max_boards").notNull(), // Max number of boards allowed
  maxTeams: integer("max_teams").notNull(), // Max number of teams allowed
  maxUsersPerCompany: integer("max_users_per_company").notNull(), // Max number of users per company
  maxTasks: integer("max_tasks").default(0), // Max number of tasks allowed (0 = unlimited)
  maxOkrs: integer("max_okrs").default(0), // Max number of OKRs allowed (0 = none)
  hasGanttView: boolean("has_gantt_view").default(false), // Whether Gantt view is available
  hasAdvancedReporting: boolean("has_advanced_reporting").default(false), // Whether advanced reporting is available
  hasApiAccess: boolean("has_api_access").default(false), // Whether API access is available
  hasCustomBranding: boolean("has_custom_branding").default(false), // Whether custom branding is available
  hasPrioritySupport: boolean("has_priority_support").default(false), // Whether priority support is available
  requiresCompany: boolean("requires_company").default(false), // Whether a company association is required for this package
  stripeProductId: text("stripe_product_id"), // Stripe product ID for this package
  stripePriceId: text("stripe_price_id"), // Stripe price ID for this package
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create insert schema for subscription packages
export const insertSubscriptionPackageSchema = createInsertSchema(subscriptionPackages)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Export types for subscription packages
export type SubscriptionPackage = typeof subscriptionPackages.$inferSelect;
export type InsertSubscriptionPackage = z.infer<typeof insertSubscriptionPackageSchema>;

// Benutzer-Abonnements
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  packageId: integer("package_id").references(() => subscriptionPackages.id).notNull(),
  status: text("status").notNull().default("pending"), // pending, active, cancelled, expired
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  billingCycle: text("billing_cycle").default("monthly"), // monthly oder yearly
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  trialEndsAt: timestamp("trial_ends_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create insert schema for subscriptions
export const insertSubscriptionSchema = createInsertSchema(subscriptions)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Export types for subscriptions
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

// Zahlungen
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id).notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("eur"),
  status: text("status").notNull(), // succeeded, pending, failed
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  paymentMethod: text("payment_method"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create insert schema for payments
export const insertPaymentSchema = createInsertSchema(payments)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Export types for payments
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// Company Payment Information Table - links to payment provider
export const companyPaymentInfo = pgTable("company_payment_info", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID
  subscriptionStatus: text("subscription_status").default("inactive"), // active, inactive, past_due, canceled, etc.
  subscriptionTier: text("subscription_tier").notNull().default("free"), // References subscription_packages.name
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  billingCycle: text("billing_cycle").default("monthly"), // monthly, yearly
  isPaused: boolean("is_paused").default(false).notNull(), // Ob das Abonnement pausiert ist
  pauseReason: text("pause_reason"), // Begründung für die Pausierung
  pausedAt: timestamp("paused_at"), // Zeitpunkt der Pausierung
  billingEmail: text("billing_email").notNull(),
  billingName: text("billing_name").notNull(),
  billingAddress: text("billing_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create insert schema for company payment info
export const insertCompanyPaymentInfoSchema = createInsertSchema(companyPaymentInfo)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Export types for company payment info
export type CompanyPaymentInfo = typeof companyPaymentInfo.$inferSelect;
export type InsertCompanyPaymentInfo = z.infer<typeof insertCompanyPaymentInfoSchema>;

// Subscription Audit Log - tracks subscription changes
export const subscriptionAuditLogs = pgTable("subscription_audit_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  userId: integer("user_id").references(() => users.id), // Der Benutzer, dessen Abonnement geändert wurde
  changedByUserId: integer("changed_by_user_id").references(() => users.id), // Der Benutzer (Admin), der die Änderung vorgenommen hat
  action: text("action").notNull(), // upgrade, downgrade, cancel, renewal, payment_failed, admin_change, user_subscription_change, etc.
  oldTier: text("old_tier"), 
  newTier: text("new_tier"),
  details: text("details"), // Additional details about the change
  amount: integer("amount"), // Amount involved in the transaction (if applicable)
  stripeEventId: text("stripe_event_id"), // Stripe event ID (if applicable)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Export types for subscription audit logs
export type SubscriptionAuditLog = typeof subscriptionAuditLogs.$inferSelect;