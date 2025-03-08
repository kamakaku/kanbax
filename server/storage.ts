import { tasks, boards, comments, checklistItems, activityLogs, type Task, type InsertTask, type UpdateTask, type Board, type InsertBoard, type UpdateBoard, type Comment, type InsertComment, type ChecklistItem, type InsertChecklistItem, type ActivityLog, type InsertActivityLog } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Board operations
  getBoards(): Promise<Board[]>;
  getBoard(id: number): Promise<Board>;
  createBoard(board: InsertBoard): Promise<Board>;
  updateBoard(id: number, board: UpdateBoard): Promise<Board>;
  deleteBoard(id: number): Promise<void>;

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
}

export class DatabaseStorage implements IStorage {
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
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.boardId, boardId))
      .orderBy(tasks.order);
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

    const [task] = await db
      .insert(tasks)
      .values(insertTask)
      .returning();

    console.log("Task created successfully:", task);
    return task;
  }

  async updateTask(id: number, updateTask: UpdateTask): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set(updateTask)
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
      .orderBy(checklistItems.item_order);
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
}

export const storage = new DatabaseStorage();