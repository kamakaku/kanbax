import { tasks, boards, columns, comments, checklistItems, activityLogs, type Task, type InsertTask, type UpdateTask, type Board, type InsertBoard, type UpdateBoard, type Column, type InsertColumn, type Comment, type InsertComment, type ChecklistItem, type InsertChecklistItem, type ActivityLog, type InsertActivityLog } from "@shared/schema";
import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { type Team } from "@shared/schema";
import { projects, type Project, type InsertProject, type UpdateProject } from "@shared/schema";
import { wikiArticles, teams, type WikiArticle, type InsertWikiArticle, type UpdateWikiArticle } from "@shared/schema"; // Added missing imports


export interface IStorage {
  // Project operations
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: UpdateProject): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  // Board operations
  getBoards(): Promise<Board[]>;
  getBoard(id: number): Promise<Board>;
  createBoard(board: InsertBoard): Promise<Board>;
  updateBoard(id: number, board: UpdateBoard): Promise<Board>;
  deleteBoard(id: number): Promise<void>;

  // Column operations
  getColumns(boardId: number): Promise<Column[]>;
  createColumn(column: InsertColumn): Promise<Column>;
  updateColumn(id: number, column: Partial<InsertColumn>): Promise<Column>;
  deleteColumn(id: number): Promise<void>;

  // Task operations
  getTasks(boardId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: UpdateTask): Promise<Task>;
  deleteTask(id: number): Promise<void>;

  // Comment operations
  getComments(taskId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;

  // Checklist operations
  getChecklistItems(taskId: number): Promise<ChecklistItem[]>;
  createChecklistItem(item: InsertChecklistItem): Promise<ChecklistItem>;
  updateChecklistItem(id: number, item: Partial<InsertChecklistItem>): Promise<ChecklistItem>;
  deleteChecklistItem(id: number): Promise<void>;

  // Activity Log operations
  getActivityLogs(taskId: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  // Add user operations
  getUser(id: number): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: Omit<InsertUser, "password"> & { passwordHash: string }): Promise<User>;

  // Wiki article operations
  getWikiArticles(projectId: number): Promise<WikiArticle[]>;
  getWikiArticle(id: number): Promise<WikiArticle>;
  createWikiArticle(article: InsertWikiArticle): Promise<WikiArticle>;
  updateWikiArticle(id: number, article: UpdateWikiArticle): Promise<WikiArticle>;
  deleteWikiArticle(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Project operations
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) {
      throw new Error(`Project ${id} not found`);
    }
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async updateProject(id: number, updateProject: UpdateProject): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set(updateProject)
      .where(eq(projects.id, id))
      .returning();

    if (!project) {
      throw new Error(`Project ${id} not found`);
    }

    return project;
  }

  async deleteProject(id: number): Promise<void> {
    const [project] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    if (!project) {
      throw new Error(`Project ${id} not found`);
    }
  }

  // Board operations
  async getBoards(): Promise<Board[]> {
    return await db.select().from(boards);
  }

  async getBoard(id: number): Promise<Board> {
    const [board] = await db.select().from(boards).where(eq(boards.id, id));
    if (!board) {
      throw new Error(`Board ${id} not found`);
    }
    return board;
  }

  async createBoard(insertBoard: InsertBoard): Promise<Board> {
    const [board] = await db
      .insert(boards)
      .values(insertBoard)
      .returning();

    // Create default columns for the new board
    const defaultColumns = [
      { title: "Backlog", order: 0 },
      { title: "To Do", order: 1 },
      { title: "In Progress", order: 2 },
      { title: "Done", order: 3 },
    ];

    for (const column of defaultColumns) {
      await db.insert(columns).values({
        title: column.title,
        boardId: board.id,
        order: column.order,
      });
    }

    return board;
  }

  async updateBoard(id: number, updateBoard: UpdateBoard): Promise<Board> {
    const [board] = await db
      .update(boards)
      .set(updateBoard)
      .where(eq(boards.id, id))
      .returning();

    if (!board) {
      throw new Error(`Board ${id} not found`);
    }

    return board;
  }

  async deleteBoard(id: number): Promise<void> {
    const [board] = await db
      .delete(boards)
      .where(eq(boards.id, id))
      .returning();

    if (!board) {
      throw new Error(`Board ${id} not found`);
    }
  }

  // Task operations
  async getTasks(boardId: number): Promise<Task[]> {
    const result = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        order: tasks.order,
        boardId: tasks.boardId,
        columnId: tasks.columnId,
        priority: tasks.priority,
        labels: tasks.labels,
        dueDate: tasks.dueDate,
        archived: tasks.archived,
        assignedUserId: tasks.assignedUserId,
        assignedTeamId: tasks.assignedTeamId,
        assignedAt: tasks.assignedAt,
        assignedUser: {
          id: users.id,
          username: users.username,
          email: users.email
        },
        assignedTeam: {
          id: teams.id,
          name: teams.name,
          description: teams.description
        }
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedUserId, users.id))
      .leftJoin(teams, eq(tasks.assignedTeamId, teams.id))
      .where(eq(tasks.boardId, boardId))
      .orderBy(tasks.order);

    return result;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    // First check if the board exists
    const [board] = await db
      .select()
      .from(boards)
      .where(eq(boards.id, insertTask.boardId));

    if (!board) {
      throw new Error(`Board ${insertTask.boardId} not found`);
    }

    console.log("Creating task with data:", insertTask);

    // Convert dueDate string to Date object if it exists
    const taskData = {
      ...insertTask,
      dueDate: insertTask.dueDate ? new Date(insertTask.dueDate) : null,
    };

    const [task] = await db
      .insert(tasks)
      .values(taskData)
      .returning();

    console.log("Task created successfully:", task);
    return task;
  }

  async updateTask(id: number, updateTask: UpdateTask): Promise<Task> {
    // Convert dueDate string to Date object if it exists
    const taskData = {
      ...updateTask,
      dueDate: updateTask.dueDate ? new Date(updateTask.dueDate) : null,
    };

    const [task] = await db
      .update(tasks)
      .set(taskData)
      .where(eq(tasks.id, id))
      .returning();

    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    return task;
  }

  async deleteTask(id: number): Promise<void> {
    const [task] = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning();

    if (!task) {
      throw new Error(`Task ${id} not found`);
    }
  }

  // Comment operations
  async getComments(taskId: number): Promise<Comment[]> {
    return await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, taskId))
      .orderBy(desc(comments.createdAt));
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    // First check if the task exists
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, insertComment.taskId));

    if (!task) {
      throw new Error(`Task ${insertComment.taskId} not found`);
    }

    console.log("Creating comment with data:", insertComment);

    const [comment] = await db
      .insert(comments)
      .values(insertComment)
      .returning();

    console.log("Comment created successfully:", comment);
    return comment;
  }

  // Checklist operations
  async getChecklistItems(taskId: number): Promise<ChecklistItem[]> {
    return await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.taskId, taskId))
      .orderBy(checklistItems.itemOrder);
  }

  async createChecklistItem(insertItem: InsertChecklistItem): Promise<ChecklistItem> {
    // First check if the task exists
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, insertItem.taskId));

    if (!task) {
      throw new Error(`Task ${insertItem.taskId} not found`);
    }

    console.log("Creating checklist item with data:", insertItem);

    const [item] = await db
      .insert(checklistItems)
      .values(insertItem)
      .returning();

    console.log("Checklist item created successfully:", item);
    return item;
  }

  async updateChecklistItem(id: number, updateItem: Partial<InsertChecklistItem>): Promise<ChecklistItem> {
    const [item] = await db
      .update(checklistItems)
      .set(updateItem)
      .where(eq(checklistItems.id, id))
      .returning();

    if (!item) {
      throw new Error(`Checklist item ${id} not found`);
    }

    return item;
  }

  async deleteChecklistItem(id: number): Promise<void> {
    const [item] = await db
      .delete(checklistItems)
      .where(eq(checklistItems.id, id))
      .returning();

    if (!item) {
      throw new Error(`Checklist item ${id} not found`);
    }
  }

  // Activity Log operations
  async getActivityLogs(taskId: number): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.taskId, taskId))
      .orderBy(desc(activityLogs.createdAt));
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    // First check if the task exists
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, insertLog.taskId));

    if (!task) {
      throw new Error(`Task ${insertLog.taskId} not found`);
    }

    console.log("Creating activity log with data:", insertLog);

    const [log] = await db
      .insert(activityLogs)
      .values(insertLog)
      .returning();

    console.log("Activity log created successfully:", log);
    return log;
  }

  // Column operations
  async getColumns(boardId: number): Promise<Column[]> {
    return await db
      .select()
      .from(columns)
      .where(eq(columns.boardId, boardId))
      .orderBy(columns.order);
  }

  async createColumn(insertColumn: InsertColumn): Promise<Column> {
    const [column] = await db
      .insert(columns)
      .values(insertColumn)
      .returning();
    return column;
  }

  async updateColumn(id: number, updateColumn: Partial<InsertColumn>): Promise<Column> {
    const [column] = await db
      .update(columns)
      .set(updateColumn)
      .where(eq(columns.id, id))
      .returning();

    if (!column) {
      throw new Error(`Column ${id} not found`);
    }

    return column;
  }

  async deleteColumn(id: number): Promise<void> {
    const [column] = await db
      .delete(columns)
      .where(eq(columns.id, id))
      .returning();

    if (!column) {
      throw new Error(`Column ${id} not found`);
    }
  }

  // Add user operations implementation
  async getUser(id: number): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    return user;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  async createUser(userData: Omit<InsertUser, "password"> & { passwordHash: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  // Wiki article implementations
  async getWikiArticles(projectId: number): Promise<WikiArticle[]> {
    return await db
      .select()
      .from(wikiArticles)
      .where(eq(wikiArticles.projectId, projectId))
      .orderBy(desc(wikiArticles.updatedAt));
  }

  async getWikiArticle(id: number): Promise<WikiArticle> {
    const [article] = await db
      .select()
      .from(wikiArticles)
      .where(eq(wikiArticles.id, id));

    if (!article) {
      throw new Error(`Wiki article ${id} not found`);
    }

    return article;
  }

  async createWikiArticle(insertArticle: InsertWikiArticle): Promise<WikiArticle> {
    const [article] = await db
      .insert(wikiArticles)
      .values(insertArticle)
      .returning();
    return article;
  }

  async updateWikiArticle(id: number, updateArticle: UpdateWikiArticle): Promise<WikiArticle> {
    const [article] = await db
      .update(wikiArticles)
      .set({
        ...updateArticle,
        updatedAt: new Date(),
      })
      .where(eq(wikiArticles.id, id))
      .returning();

    if (!article) {
      throw new Error(`Wiki article ${id} not found`);
    }

    return article;
  }

  async deleteWikiArticle(id: number): Promise<void> {
    const [article] = await db
      .delete(wikiArticles)
      .where(eq(wikiArticles.id, id))
      .returning();

    if (!article) {
      throw new Error(`Wiki article ${id} not found`);
    }
  }
}

export const storage = new DatabaseStorage();