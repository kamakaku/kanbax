import { tasks, boards, type Task, type InsertTask, type UpdateTask, type Board, type InsertBoard, type UpdateBoard } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
    const [task] = await db
      .insert(tasks)
      .values(insertTask)
      .returning();
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
}

export const storage = new DatabaseStorage();