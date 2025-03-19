import { tasks, boards, columns, comments, checklistItems, activityLogs, type Task, type InsertTask, type UpdateTask, type Board, type InsertBoard, type UpdateBoard, type Column, type InsertColumn, type Comment, type InsertComment, type ChecklistItem, type InsertChecklistItem, type ActivityLog, type InsertActivityLog } from "@shared/schema";
import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, type SQL } from "drizzle-orm";
import { PgArray } from "drizzle-orm/pg-core";
import { teams, type Team, type InsertTeam } from "@shared/schema";
import { projects, type Project, type InsertProject, type UpdateProject } from "@shared/schema";
import { userProductivityMetrics, taskStateChanges, taskTimeEntries, type UserProductivityMetrics, type TaskStateChange, type TaskTimeEntry, type InsertUserProductivityMetrics, type InsertTaskStateChange, type InsertTaskTimeEntry } from "@shared/schema";
import { objectives, type Objective, type InsertObjective } from "@shared/schema";

export interface IStorage {
  // Project operations
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: UpdateProject): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  // Board operations
  getBoards(): Promise<Board[]>;
  getBoardsByProject(projectId: number): Promise<Board[]>;
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

  // User operations
  getUser(id: number): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: Omit<InsertUser, "password"> & { passwordHash: string }): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  updateUserPassword(id: number, passwordHash: string): Promise<void>;
  updateUserEmail(id: number, email: string): Promise<User>;
  getUsers(): Promise<User[]>;

  // Team operations
  getTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: number): Promise<void>;

  // Favorite operations
  toggleProjectFavorite(id: number): Promise<Project>;
  toggleBoardFavorite(id: number): Promise<Board>;
  toggleObjectiveFavorite(id: number): Promise<Objective>;
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
    // Ensure teamIds is an array, even if empty
    const projectData = {
      ...updateProject,
      teamIds: Array.isArray(updateProject.teamIds) ? updateProject.teamIds : [],
      isFavorite: updateProject.isFavorite ?? undefined,
    };

    console.log("Updating project with data:", projectData); // Debug log

    const [project] = await db
      .update(projects)
      .set(projectData)
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
    try {
      console.log("Fetching all boards...");
      const boardResults = await db.select().from(boards);
      console.log("Retrieved boards:", boardResults);

      // Process each board to include teams and project data
      const processedBoards = await Promise.all(boardResults.map(async (board) => {
        // Get teams data
        let teamsData: Team[] = [];
        if (board.teamIds && Array.isArray(board.teamIds) && board.teamIds.length > 0) {
          teamsData = await db
            .select()
            .from(teams)
            .where(sql`${teams.id} = ANY(${board.teamIds})`);
        }

        // Get assigned users data
        let assignedUsers = [];
        if (board.assignedUserIds && Array.isArray(board.assignedUserIds) && board.assignedUserIds.length > 0) {
          const users = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              avatarUrl: users.avatarUrl
            })
            .from(users)
            .where(sql`${users.id} = ANY(${board.assignedUserIds})`);
          assignedUsers = users;
        }

        // Get project data if exists
        let projectData = null;
        if (board.projectId) {
          const [project] = await db
            .select({
              id: projects.id,
              title: projects.title,
            })
            .from(projects)
            .where(eq(projects.id, board.projectId));
          projectData = project;
        }

        return {
          ...board,
          teams: teamsData,
          assignedUsers: assignedUsers,
          project: projectData,
        };
      }));

      console.log("Processed boards with related data:", processedBoards);
      return processedBoards;
    } catch (error) {
      console.error("Error in getBoards:", error);
      throw error;
    }
  }

  async getBoardsByProject(projectId: number): Promise<Board[]> {
    return await db
      .select()
      .from(boards)
      .where(eq(boards.projectId, projectId));
  }

  async getBoard(id: number): Promise<Board> {
    const [board] = await db
      .select()
      .from(boards)
      .where(eq(boards.id, id));

    if (!board) {
      throw new Error(`Board ${id} not found`);
    }

    return board;
  }

  async createBoard(insertBoard: InsertBoard): Promise<Board> {
    try {
      console.log("Storage: Creating board with data:", JSON.stringify(insertBoard, null, 2));

      // Ensure arrays are properly handled
      const boardData = {
        title: insertBoard.title,
        description: insertBoard.description || null,
        project_id: insertBoard.project_id || null,
        creator_id: insertBoard.creator_id,
        team_ids: Array.isArray(insertBoard.team_ids)
          ? insertBoard.team_ids.filter(id => id > 0)
          : [],
        assigned_user_ids: Array.isArray(insertBoard.assigned_user_ids)
          ? insertBoard.assigned_user_ids.filter(id => id > 0)
          : [],
        is_favorite: insertBoard.is_favorite || false
      };

      console.log("Storage: Processed board data:", JSON.stringify(boardData, null, 2));

      // Create the board
      const [board] = await db
        .insert(boards)
        .values(boardData)
        .returning();

      if (!board) {
        throw new Error("Failed to create board - no data returned");
      }

      console.log("Storage: Created board:", JSON.stringify(board, null, 2));

      // Create default columns
      const defaultColumns = [
        { title: "Backlog", order: 0 },
        { title: "To Do", order: 1 },
        { title: "In Progress", order: 2 },
        { title: "Done", order: 3 }
      ];

      for (const column of defaultColumns) {
        await db.insert(columns).values({
          title: column.title,
          boardId: board.id,
          order: column.order
        });
      }

      // Fetch and return the complete board with associations
      const completeBoard = await this.getBoard(board.id);
      console.log("Storage: Returning complete board:", JSON.stringify(completeBoard, null, 2));
      return completeBoard;

    } catch (error) {
      console.error("Storage: Error in createBoard:", error);
      throw error;
    }
  }

  async updateBoard(id: number, updateBoard: UpdateBoard): Promise<Board> {
    try {
      // Hole existierendes Board
      const [existingBoard] = await db
        .select()
        .from(boards)
        .where(eq(boards.id, id));

      if (!existingBoard) {
        throw new Error(`Board ${id} not found`);
      }

      // Simples Update mit Beibehaltung der Arrays wenn sie leer sind
      const updateData = {
        title: updateBoard.title || existingBoard.title,
        description: updateBoard.description ?? existingBoard.description,
        project_id: updateBoard.project_id ?? existingBoard.project_id,
        creator_id: existingBoard.creator_id,
        team_ids: Array.isArray(updateBoard.team_ids) ? updateBoard.team_ids : existingBoard.team_ids,
        assigned_user_ids: Array.isArray(updateBoard.assigned_user_ids) ? updateBoard.assigned_user_ids : existingBoard.assigned_user_ids,
        is_favorite: updateBoard.is_favorite ?? existingBoard.is_favorite
      };

      console.log("Updating board with data:", updateData);

      // Update durchführen
      const [updatedBoard] = await db
        .update(boards)
        .set(updateData)
        .where(eq(boards.id, id))
        .returning();

      if (!updatedBoard) {
        throw new Error(`Failed to update board ${id}`);
      }

      return updatedBoard;
    } catch (error) {
      console.error("Error in updateBoard:", error);
      throw error;
    }
  }

  async updateBoardUsers(boardId: number, userIds: number[]): Promise<void> {
    // First delete existing user assignments
    await db.delete(boardMembers).where(eq(boardMembers.boardId, boardId));

    // Then insert new user assignments
    if (userIds.length > 0) {
      await db.insert(boardMembers).values(userIds.map(userId => ({
        boardId,
        userId,
        role: 'member'
      })));
    }
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

  // Board permission implementations
  async createBoardMember(member: InsertBoardMember): Promise<BoardMember> {
    const [record] = await db
      .insert(boardMembers)
      .values(member)
      .returning();
    return record;
  }

  async getBoardMembers(boardId: number): Promise<BoardMember[]> {
    return await db
      .select()
      .from(boardMembers)
      .where(eq(boardMembers.boardId, boardId))
      .orderBy(boardMembers.invitedAt);
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

  // Task operations
  async getTasks(boardId: number): Promise<Task[]> {
    const result = await db
      .select()
      .from(tasks)
      .where(eq(tasks.boardId, boardId))
      .orderBy(tasks.order);

    return result.map(task => ({
      ...task,
      checklist: Array.isArray(task.checklist) ? task.checklist : [],
      assignedUserIds: Array.isArray(task.assignedUserIds) ? task.assignedUserIds : [],
    }));
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values({
        ...insertTask,
        checklist: insertTask.checklist || [],
        assignedUserIds: insertTask.assignedUserIds || [],
      })
      .returning();

    return {
      ...task,
      checklist: Array.isArray(task.checklist) ? task.checklist : [],
      assignedUserIds: Array.isArray(task.assignedUserIds) ? task.assignedUserIds : [],
    };
  }

  async updateTask(id: number, updateTask: UpdateTask): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set({
        ...updateTask,
        checklist: updateTask.checklist || [],
        assignedUserIds: updateTask.assignedUserIds || [],
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    return {
      ...task,
      checklist: Array.isArray(task.checklist) ? task.checklist : [],
      assignedUserIds: Array.isArray(task.assignedUserIds) ? task.assignedUserIds : [],
    };
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
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, insertComment.taskId));

    if (!task) {
      throw new Error(`Task ${insertComment.taskId} not found`);
    }

    const [comment] = await db
      .insert(comments)
      .values(insertComment)
      .returning();

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
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, insertItem.taskId));

    if (!task) {
      throw new Error(`Task ${insertItem.taskId} not found`);
    }

    const [item] = await db
      .insert(checklistItems)
      .values(insertItem)
      .returning();

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
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, insertLog.taskId));

    if (!task) {
      throw new Error(`Task ${insertLog.taskId} not found`);
    }

    const [log] = await db
      .insert(activityLogs)
      .values(insertLog)
      .returning();

    return log;
  }

  // User operations
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

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    return user;
  }

  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    const [user] = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      throw new Error(`User ${id} not found`);
    }
  }

  async updateUserEmail(id: number, email: string): Promise<User> {
    const existingUser = await this.getUserByEmail(email);
    if (existingUser && existingUser.id !== id) {
      throw new Error('Email is already taken');
    }

    const [user] = await db
      .update(users)
      .set({ email })
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Productivity metrics implementations
  async getUserProductivityMetrics(userId: number, days: number): Promise<UserProductivityMetrics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await db
      .select()
      .from(userProductivityMetrics)
      .where(
        and(
          eq(userProductivityMetrics.userId, userId),
          gte(userProductivityMetrics.date, startDate)
        )
      )
      .orderBy(userProductivityMetrics.date);
  }

  async createUserProductivityMetrics(metrics: InsertUserProductivityMetrics): Promise<UserProductivityMetrics> {
    const [result] = await db
      .insert(userProductivityMetrics)
      .values(metrics)
      .returning();
    return result;
  }

  async getTaskDistribution(userId: number): Promise<{ name: string; value: number; }[]> {
    const result = await db.execute<{ name: string; value: number; }>(sql`
      WITH user_tasks AS (
        SELECT DISTINCT t.id, t.status
        FROM tasks t
        LEFT JOIN task_state_changes tsc ON t.id = tsc.task_id
        WHERE t.assigned_user_ids @> ARRAY[${userId}]::int[]
        OR tsc.user_id = ${userId}
      )
      SELECT status as name, COUNT(*) as value
      FROM user_tasks
      GROUP BY status
    `);

    // Ensure we always return an array
    return Array.isArray(result) ? result : result.rows || [];
  }

  // Task time tracking implementations
  async createTaskTimeEntry(entry: InsertTaskTimeEntry): Promise<TaskTimeEntry> {
    const [result] = await db
      .insert(taskTimeEntries)
      .values(entry)
      .returning();
    return result;
  }

  async updateTaskTimeEntry(id: number, endTime: Date): Promise<TaskTimeEntry> {
    const [result] = await db
      .update(taskTimeEntries)
      .set({
        endTime,
        durationMinutes: sql`EXTRACT(EPOCH FROM ${endTime}::timestamp - start_time) / 60`
      })
      .where(eq(taskTimeEntries.id, id))
      .returning();

    if (!result) {
      throw new Error(`Task time entry ${id} not found`);
    }

    return result;
  }

  // Task state change implementations
  async createTaskStateChange(change: InsertTaskStateChange): Promise<TaskStateChange> {
    const [result] = await db
      .insert(taskStateChanges)
      .values(change)
      .returning();
    return result;
  }

  // Team operations
  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  async getTeam(id: number): Promise<Team> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, id));

    if (!team) {
      throw new Error(`Team ${id} not found`);
    }

    return team;
  }

  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const { memberIds, ...teamData } = insertTeam;

    // Create the team first
    const [team] = await db
      .insert(teams)
      .values(teamData)
      .returning();

    // If memberIds are provided, create team member relationships
    if (memberIds && memberIds.length > 0) {
      const memberEntries = memberIds.map(id => ({
        teamId: team.id,
        userId: parseInt(id),
        role: 'member'
      }));

      await db
        .insert(teamMembers)
        .values(memberEntries);
    }

    return team;
  }

  async updateTeam(id: number, updateTeam: Partial<InsertTeam>): Promise<Team> {
    const { memberIds, ...teamData } = updateTeam;

    // Update the team data
    const [team] = await db
      .update(teams)
      .set(teamData)
      .where(eq(teams.id, id))
      .returning();

    if (!team) {
      throw new Error(`Team ${id} not found`);
    }

    // If memberIds are provided, update team members
    if (memberIds) {
      // First remove all existing members
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.teamId, id));

      // Then add the new members
      if (memberIds.length > 0) {
        const memberEntries = memberIds.map(memberId => ({
          teamId: id,
          userId: parseInt(memberId),
          role: 'member'
        }));

        await db
          .insert(teamMembers)
          .values(memberEntries);
      }
    }

    return team;
  }

  async deleteTeam(id: number): Promise<void> {
    // First delete all team member relationships
    await db
      .delete(teamMembers)
      .where(eq(teamMembers.teamId, id));

    // Then delete the team
    const [team] = await db
      .delete(teams)
      .where(eq(teams.id, id))
      .returning();

    if (!team) {
      throw new Error(`Team ${id} not found`);
    }
  }
  // Team member operations
  async getTeamMembers(): Promise<TeamMember[]> {
    return await db.select().from(teamMembers);
  }

  async toggleProjectFavorite(id: number): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ isFavorite: sql`NOT ${projects.isFavorite}` })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async toggleBoardFavorite(id: number): Promise<Board> {
    const [board] = await db
      .update(boards)
      .set({ isFavorite: sql`NOT ${boards.isFavorite}` })
      .where(eq(boards.id, id))
      .returning();
    return board;
  }

  async toggleObjectiveFavorite(id: number): Promise<Objective> {
    const [objective] = await db
      .update(objectives)
      .set({ isFavorite: sql`NOT ${objectives.isFavorite}` })
      .where(eq(objectives.id, id))
      .returning();
    return objective;
  }
}

export const storage = new DatabaseStorage();