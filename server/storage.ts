import { tasks, boards, columns, comments, checklistItems, activityLogs, type Task, type InsertTask, type UpdateTask, type Board, type InsertBoard, type UpdateBoard, type Column, type InsertColumn, type Comment, type InsertComment, type ChecklistItem, type InsertChecklistItem, type ActivityLog, type InsertActivityLog } from "@shared/schema";
import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, inArray, sql, type SQL } from "drizzle-orm";
import { teams, teamMembers, type Team, type InsertTeam, type TeamMember, type InsertTeamMember } from "@shared/schema";
import { projects, type Project, type InsertProject, type UpdateProject } from "@shared/schema";
import { userProductivityMetrics, taskStateChanges, taskTimeEntries, type UserProductivityMetrics, type TaskStateChange, type TaskTimeEntry, type InsertUserProductivityMetrics, type InsertTaskStateChange, type InsertTaskTimeEntry } from "@shared/schema";
import { objectives, type Objective, type InsertObjective } from "@shared/schema";
import { userFavoriteProjects, userFavoriteBoards, userFavoriteObjectives, type UserFavoriteProject, type UserFavoriteBoard, type UserFavoriteObjective } from "@shared/schema";
import { companies, type Company, type InsertCompany, type CompanyResponse } from "@shared/schema";
import { permissionService } from "./permissions";


export interface IStorage {
  // Project operations
  getProjects(userId: number): Promise<Project[]>;
  getProject(userId: number, id: number): Promise<Project>;
  createProject(userId: number, project: InsertProject): Promise<Project>;
  updateProject(userId: number, id: number, project: UpdateProject): Promise<Project>;
  deleteProject(userId: number, id: number): Promise<void>;

  // Board operations
  getBoards(userId: number): Promise<Board[]>;
  getBoardsByProject(userId: number, projectId: number): Promise<Board[]>;
  getBoard(userId: number, id: number): Promise<Board>;
  createBoard(userId: number, board: InsertBoard): Promise<Board>;
  updateBoard(userId: number, id: number, board: UpdateBoard): Promise<Board>;
  deleteBoard(userId: number, id: number): Promise<void>;

  // Column operations
  getColumns(userId: number, boardId: number): Promise<Column[]>;
  createColumn(userId: number, column: InsertColumn): Promise<Column>;
  updateColumn(userId: number, id: number, column: Partial<InsertColumn>): Promise<Column>;
  deleteColumn(userId: number, id: number): Promise<void>;

  // Task operations
  getTasks(userId: number, boardId: number): Promise<Task[]>;
  createTask(userId: number, task: InsertTask): Promise<Task>;
  updateTask(userId: number, id: number, task: UpdateTask): Promise<Task>;
  deleteTask(userId: number, id: number): Promise<void>;

  // Comment operations
  getComments(userId: number, taskId: number): Promise<Comment[]>;
  createComment(userId: number, comment: InsertComment): Promise<Comment>;

  // Checklist operations
  getChecklistItems(userId: number, taskId: number): Promise<ChecklistItem[]>;
  createChecklistItem(userId: number, item: InsertChecklistItem): Promise<ChecklistItem>;
  updateChecklistItem(userId: number, id: number, item: Partial<InsertChecklistItem>): Promise<ChecklistItem>;
  deleteChecklistItem(userId: number, id: number): Promise<void>;

  // Activity Log operations
  getActivityLogs(userId: number): Promise<ActivityLog[]>;
  createActivityLog(userId: number, log: InsertActivityLog): Promise<ActivityLog>;

  // User operations
  getUser(userId: number, id: number): Promise<User>;
  getUserByUsername(userId: number, username: string): Promise<User | null>;
  getUserByEmail(userId: number, email: string): Promise<User | null>;
  createUser(userId: number, user: Omit<InsertUser, "password"> & { passwordHash: string }): Promise<User>;
  updateUser(userId: number, id: number, data: Partial<User>): Promise<User>;
  updateUserPassword(userId: number, id: number, passwordHash: string): Promise<void>;
  updateUserEmail(userId: number, id: number, email: string): Promise<User>;
  getUsers(userId: number): Promise<User[]>;

  // Team operations
  getTeams(userId: number): Promise<Team[]>;
  getTeam(userId: number, id: number): Promise<Team>;
  createTeam(userId: number, team: InsertTeam): Promise<Team>;
  updateTeam(userId: number, id: number, team: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(userId: number, id: number): Promise<void>;

  // Favorite operations
  toggleProjectFavorite(userId: number, id: number): Promise<Project>;
  toggleBoardFavorite(userId: number, id: number): Promise<Board>;
  toggleObjectiveFavorite(userId: number, id: number): Promise<Objective>;
  createObjective(userId: number, objective: InsertObjective): Promise<Objective>;
  
  // Company operations
  getCompany(userId: number, id: number): Promise<Company>;
  getCurrentUserCompany(userId: number): Promise<CompanyResponse>;
  getCompanyMembers(userId: number, companyId: number): Promise<User[]>;
  updateUserCompanyRole(userId: number, targetUserId: number, isAdmin: boolean): Promise<User>;
  generateCompanyInviteCode(userId: number, companyId: number): Promise<string>;
  joinCompanyWithInviteCode(userId: number, inviteCode: string): Promise<Company>;
  createCompany(userId: number, company: InsertCompany): Promise<Company>;
}

export class DatabaseStorage implements IStorage {
  permissionService = permissionService;
  // Project operations
  async getProjects(userId: number): Promise<Project[]> {
    try {
      console.log("Fetching projects for user:", userId);
      const projectResults = await db.select().from(projects);
      
      // Favoriten für diesen Benutzer abrufen
      const favoriteProjects = await db
        .select()
        .from(userFavoriteProjects)
        .where(eq(userFavoriteProjects.userId, userId));
      
      // Set mit Favoriten-Projekt-IDs erstellen für schnelle Suche
      const favoriteProjectIds = new Set(favoriteProjects.map(fp => fp.projectId));
      
      // Berechtigungsprüfung für alle Projekte
      const accessibleProjectsPromises = projectResults.map(async (project) => {
        const hasAccess = await permissionService.canAccessProject(userId, project.id);
        if (hasAccess) {
          // Personalisierter Favoriten-Status basierend auf userFavoriteProjects
          return {
            ...project,
            isFavorite: favoriteProjectIds.has(project.id)
          };
        }
        return null;
      });
      
      const accessibleProjects = (await Promise.all(accessibleProjectsPromises)).filter((project): project is Project => project !== null);
      console.log(`User ${userId} has access to ${accessibleProjects.length} of ${projectResults.length} projects`);
      
      return accessibleProjects;
    } catch (error) {
      console.error("Error in getProjects:", error);
      throw error;
    }
  }

  async getProject(userId: number, id: number): Promise<Project> {
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      if (!project || !(await permissionService.canAccessProject(userId, id))) {
        throw new Error(`Project ${id} not found or unauthorized access`);
      }
      
      // Prüfen, ob das Projekt ein Favorit des aktuellen Benutzers ist
      const [favorite] = await db
        .select()
        .from(userFavoriteProjects)
        .where(and(
          eq(userFavoriteProjects.userId, userId),
          eq(userFavoriteProjects.projectId, id)
        ));
      
      // Personalisierter Favoriten-Status basierend auf userFavoriteProjects
      return {
        ...project,
        isFavorite: favorite ? true : false
      };
    } catch (error) {
      console.error("Error in getProject:", error);
      throw error;
    }
  }

  async createProject(userId: number, insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async updateProject(userId: number, id: number, updateProject: UpdateProject): Promise<Project> {
    if (!(await permissionService.canAccessProject(userId, id))) {
      throw new Error(`Project ${id} not found or unauthorized access`);
    }
    const projectData = {
      ...updateProject,
      teamIds: Array.isArray(updateProject.teamIds) ? updateProject.teamIds : [],
      isFavorite: updateProject.isFavorite ?? undefined,
    };

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

  async deleteProject(userId: number, id: number): Promise<void> {
    if (!(await permissionService.canAccessProject(userId, id))) {
      throw new Error(`Project ${id} not found or unauthorized access`);
    }
    const [project] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();

    if (!project) {
      throw new Error(`Project ${id} not found`);
    }
  }

  // Board operations
  async getBoards(userId: number): Promise<Board[]> {
    try {
      console.log("Fetching boards for user:", userId);
      const boardResults = await db.select().from(boards);

      // Favoriten für diesen Benutzer abrufen
      const favoriteBoards = await db
        .select()
        .from(userFavoriteBoards)
        .where(eq(userFavoriteBoards.userId, userId));
      
      // Set mit Favoriten-Board-IDs erstellen für schnelle Suche
      const favoriteBoardIds = new Set(favoriteBoards.map(fb => fb.boardId));

      // Berechtigungsprüfung für alle Boards
      const accessibleBoardsPromises = boardResults.map(async (board) => {
        const hasAccess = await permissionService.canAccessBoard(userId, board.id);
        if (hasAccess) {
          // Personalisierter Favoriten-Status basierend auf userFavoriteBoards
          return {
            ...board,
            is_favorite: favoriteBoardIds.has(board.id)
          };
        }
        return null;
      });
      
      const accessibleBoards = (await Promise.all(accessibleBoardsPromises)).filter((board): board is Board => board !== null);
      console.log(`User ${userId} has access to ${accessibleBoards.length} of ${boardResults.length} boards`);

      const processedBoards = await Promise.all(accessibleBoards.map(async (board) => {
        let teamsData: Team[] = [];
        if (board.team_ids && Array.isArray(board.team_ids) && board.team_ids.length > 0) {
          teamsData = await db
            .select()
            .from(teams)
            .where(inArray(teams.id, board.team_ids));
        }

        let assignedUsers = [];
        if (board.assigned_user_ids && Array.isArray(board.assigned_user_ids) && board.assigned_user_ids.length > 0) {
          const usersList = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              avatarUrl: users.avatarUrl
            })
            .from(users)
            .where(inArray(users.id, board.assigned_user_ids));
          assignedUsers = usersList;
        }

        let projectData = null;
        if (board.project_id) {
          const [project] = await db
            .select({
              id: projects.id,
              title: projects.title,
            })
            .from(projects)
            .where(eq(projects.id, board.project_id));
          projectData = project;
        }

        return {
          ...board,
          teams: teamsData,
          assignedUsers: assignedUsers,
          project: projectData,
        };
      }));

      return processedBoards;
    } catch (error) {
      console.error("Error in getBoards:", error);
      throw error;
    }
  }

  async getBoardsByProject(userId: number, projectId: number): Promise<Board[]> {
    try {
      console.log(`Fetching boards for project ${projectId} and user ${userId}`);
      const boardResults = await db
        .select()
        .from(boards)
        .where(eq(boards.project_id, projectId));
      
      // Favoriten für diesen Benutzer abrufen
      const favoriteBoards = await db
        .select()
        .from(userFavoriteBoards)
        .where(eq(userFavoriteBoards.userId, userId));
      
      // Set mit Favoriten-Board-IDs erstellen für schnelle Suche
      const favoriteBoardIds = new Set(favoriteBoards.map(fb => fb.boardId));
      
      // Berechtigungsprüfung für alle Boards
      const accessibleBoardsPromises = boardResults.map(async (board) => {
        const hasAccess = await permissionService.canAccessBoard(userId, board.id);
        if (hasAccess) {
          // Personalisierter Favoriten-Status basierend auf userFavoriteBoards
          return {
            ...board,
            is_favorite: favoriteBoardIds.has(board.id)
          };
        }
        return null;
      });
      
      const accessibleBoards = (await Promise.all(accessibleBoardsPromises)).filter((board): board is Board => board !== null);
      console.log(`User ${userId} has access to ${accessibleBoards.length} of ${boardResults.length} boards in project ${projectId}`);
      
      return accessibleBoards;
    } catch (error) {
      console.error(`Error in getBoardsByProject for project ${projectId}:`, error);
      throw error;
    }
  }

  async getBoard(userId: number, id: number): Promise<Board> {
    try {
      const [board] = await db
        .select()
        .from(boards)
        .where(eq(boards.id, id));

      if (!board || !(await permissionService.canAccessBoard(userId, id))) {
        throw new Error(`Board ${id} not found or unauthorized access`);
      }
      
      // Prüfen, ob das Board ein Favorit des aktuellen Benutzers ist
      const [favorite] = await db
        .select()
        .from(userFavoriteBoards)
        .where(and(
          eq(userFavoriteBoards.userId, userId),
          eq(userFavoriteBoards.boardId, id)
        ));
      
      // Personalisierter Favoriten-Status basierend auf userFavoriteBoards
      const isFavorite = favorite ? true : false;

      let boardTeams: Team[] = [];
      if (board.team_ids && board.team_ids.length > 0) {
        boardTeams = await db
          .select()
          .from(teams)
          .where(inArray(teams.id, board.team_ids));
      }

      let boardUsers: User[] = [];
      if (board.assigned_user_ids && board.assigned_user_ids.length > 0) {
        boardUsers = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl
          })
          .from(users)
          .where(inArray(users.id, board.assigned_user_ids));
      }

      let projectData = null;
      if (board.project_id) {
        [projectData] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, board.project_id));
      }

      return {
        ...board,
        teams: boardTeams,
        users: boardUsers,
        project: projectData,
        is_favorite: isFavorite
      };

    } catch (error) {
      console.error("Error in getBoard:", error);
      throw error;
    }
  }

  async createBoard(userId: number, insertBoard: InsertBoard): Promise<Board> {
    try {
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

      const [board] = await db
        .insert(boards)
        .values(boardData)
        .returning();

      if (!board) {
        throw new Error("Failed to create board - no data returned");
      }

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

      const completeBoard = await this.getBoard(userId, board.id);
      return completeBoard;

    } catch (error) {
      console.error("Storage: Error in createBoard:", error);
      throw error;
    }
  }

  async updateBoard(userId: number, id: number, updateBoard: UpdateBoard): Promise<Board> {
    try {
      if (!(await permissionService.canAccessBoard(userId, id))) {
        throw new Error(`Board ${id} not found or unauthorized access`);
      }
      const [existingBoard] = await db
        .select()
        .from(boards)
        .where(eq(boards.id, id));

      if (!existingBoard) {
        throw new Error(`Board ${id} not found`);
      }

      const updateData = {
        title: updateBoard.title || existingBoard.title,
        description: updateBoard.description ?? existingBoard.description,
        project_id: updateBoard.project_id ?? existingBoard.project_id,
        creator_id: existingBoard.creator_id,
        team_ids: Array.isArray(updateBoard.team_ids) ? updateBoard.team_ids : existingBoard.team_ids,
        assigned_user_ids: Array.isArray(updateBoard.assigned_user_ids) ? updateBoard.assigned_user_ids : existingBoard.assigned_user_ids,
        is_favorite: updateBoard.is_favorite ?? existingBoard.is_favorite
      };


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

  async updateBoardUsers(userId: number, boardId: number, userIds: number[]): Promise<void> {
    if (!(await permissionService.canAccessBoard(userId, boardId))) {
      throw new Error(`Board ${boardId} not found or unauthorized access`);
    }
    await db.delete(boardMembers).where(eq(boardMembers.boardId, boardId));

    if (userIds.length > 0) {
      await db.insert(boardMembers).values(userIds.map(userId => ({
        boardId,
        userId,
        role: 'member'
      })));
    }
  }

  async deleteBoard(userId: number, id: number): Promise<void> {
    if (!(await permissionService.canAccessBoard(userId, id))) {
      throw new Error(`Board ${id} not found or unauthorized access`);
    }
    const [board] = await db
      .delete(boards)
      .where(eq(boards.id, id))
      .returning();

    if (!board) {
      throw new Error(`Board ${id} not found`);
    }
  }

  // Board permission implementations
  async createBoardMember(userId: number, member: InsertBoardMember): Promise<BoardMember> {
    const [record] = await db
      .insert(boardMembers)
      .values(member)
      .returning();
    return record;
  }

  async getBoardMembers(userId: number, boardId: number): Promise<BoardMember[]> {
    const members = await db
      .select()
      .from(boardMembers)
      .where(eq(boardMembers.boardId, boardId))
      .orderBy(boardMembers.invitedAt);
    return permissionService.filterBoardMembers(userId, members);
  }


  // Column operations
  async getColumns(userId: number, boardId: number): Promise<Column[]> {
    const columnsData = await db
      .select()
      .from(columns)
      .where(eq(columns.boardId, boardId))
      .orderBy(columns.order);
    return permissionService.filterColumns(userId, columnsData);
  }

  async createColumn(userId: number, insertColumn: InsertColumn): Promise<Column> {
    const [column] = await db
      .insert(columns)
      .values(insertColumn)
      .returning();
    return column;
  }

  async updateColumn(userId: number, id: number, updateColumn: Partial<InsertColumn>): Promise<Column> {
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

  async deleteColumn(userId: number, id: number): Promise<void> {
    const [column] = await db
      .delete(columns)
      .where(eq(columns.id, id))
      .returning();

    if (!column) {
      throw new Error(`Column ${id} not found`);
    }
  }

  // Task operations
  async getTasks(userId: number, boardId: number): Promise<Task[]> {
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

  async createTask(userId: number, insertTask: InsertTask): Promise<Task> {
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

  async updateTask(userId: number, id: number, updateTask: UpdateTask): Promise<Task> {
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

  async deleteTask(userId: number, id: number): Promise<void> {
    const [task] = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning();

    if (!task) {
      throw new Error(`Task ${id} not found`);
    }
  }

  // Comment operations
  async getComments(userId: number, taskId: number): Promise<Comment[]> {
    const commentsData = await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, taskId))
      .orderBy(desc(comments.createdAt));
    return permissionService.filterComments(userId, commentsData);
  }

  async createComment(userId: number, insertComment: InsertComment): Promise<Comment> {
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
  async getChecklistItems(userId: number, taskId: number): Promise<ChecklistItem[]> {
    const checklistItemsData = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.taskId, taskId))
      .orderBy(checklistItems.itemOrder);
    return permissionService.filterChecklistItems(userId, checklistItemsData);
  }

  async createChecklistItem(userId: number, insertItem: InsertChecklistItem): Promise<ChecklistItem> {
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

  async updateChecklistItem(userId: number, id: number, updateItem: Partial<InsertChecklistItem>): Promise<ChecklistItem> {
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

  async deleteChecklistItem(userId: number, id: number): Promise<void> {
    const [item] = await db
      .delete(checklistItems)
      .where(eq(checklistItems.id, id))
      .returning();

    if (!item) {
      throw new Error(`Checklist item ${id} not found`);
    }
  }

  // Activity Log operations
  async getActivityLogs(userId: number): Promise<ActivityLog[]> {
    return await permissionService.getVisibleActivityLogs(userId);
  }

  async createActivityLog(userId: number, log: InsertActivityLog): Promise<ActivityLog> {
    try {
      const dbLog = {
        action: log.action,
        details: log.details,
        userId: log.userId,
        boardId: log.boardId,
        projectId: log.projectId,
        objectiveId: log.objectiveId,
        taskId: log.taskId,
        createdAt: new Date()
      };

      const [newLog] = await db
        .insert(activityLogs)
        .values(dbLog)
        .returning();

      return newLog;
    } catch (error) {
      console.error("Error creating activity log:", error);
      throw error;
    }
  }

  // User operations
  async getUser(userId: number, id: number): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user || !(await permissionService.canAccessUser(userId, id))) {
      throw new Error(`User ${id} not found or unauthorized access`);
    }
    return user;
  }

  async getUserByUsername(userId: number, username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || null;
  }

  async getUserByEmail(userId: number, email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  async createUser(userId: number, userData: Omit<InsertUser, "password"> & { passwordHash: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(userId: number, id: number, data: Partial<User>): Promise<User> {
    if (!(await permissionService.canAccessUser(userId, id))) {
      throw new Error(`User ${id} not found or unauthorized access`);
    }
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

  async updateUserPassword(userId: number, id: number, passwordHash: string): Promise<void> {
    if (!(await permissionService.canAccessUser(userId, id))) {
      throw new Error(`User ${id} not found or unauthorized access`);
    }
    const [user] = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      throw new Error(`User ${id} not found`);
    }
  }

  async updateUserEmail(userId: number, id: number, email: string): Promise<User> {
    if (!(await permissionService.canAccessUser(userId, id))) {
      throw new Error(`User ${id} not found or unauthorized access`);
    }
    const existingUser = await this.getUserByEmail(userId, email);
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

  async getUsers(userId: number): Promise<User[]> {
    const usersData = await db.select().from(users);
    return permissionService.filterUsers(userId, usersData);
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

  async createUserProductivityMetrics(userId: number, metrics: InsertUserProductivityMetrics): Promise<UserProductivityMetrics> {
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

    return Array.isArray(result) ? result : result.rows || [];
  }

  // Task time tracking implementations
  async createTaskTimeEntry(userId: number, entry: InsertTaskTimeEntry): Promise<TaskTimeEntry> {
    const [result] = await db
      .insert(taskTimeEntries)
      .values(entry)
      .returning();
    return result;
  }

  async updateTaskTimeEntry(userId: number, id: number, endTime: Date): Promise<TaskTimeEntry> {
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
  async createTaskStateChange(userId: number, change: InsertTaskStateChange): Promise<TaskStateChange> {
    const [result] = await db
      .insert(taskStateChanges)
      .values(change)
      .returning();
    return result;
  }

  // Team operations
  async getTeams(userId: number): Promise<Team[]> {
    const teamsData = await db.select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      companyId: teams.companyId,
      creatorId: teams.creatorId,
      createdAt: teams.createdAt,
    }).from(teams);
    
    return permissionService.filterTeams(userId, teamsData);
  }

  async getTeam(userId: number, id: number): Promise<Team> {
    const [team] = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        companyId: teams.companyId,
        creatorId: teams.creatorId,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(eq(teams.id, id));

    if (!team || !(await permissionService.canAccessTeam(userId, id))) {
      throw new Error(`Team ${id} not found or unauthorized access`);
    }

    return team;
  }

  async createTeam(userId: number, insertTeam: InsertTeam): Promise<Team> {
    const { member_ids, ...teamData } = insertTeam;
    
    // Füge creatorId hinzu
    const fullTeamData = {
      ...teamData,
      creatorId: userId
    };

    const [team] = await db
      .insert(teams)
      .values(fullTeamData)
      .returning();

    if (member_ids && member_ids.length > 0) {
      const memberEntries = member_ids.map(id => ({
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

  async updateTeam(userId: number, id: number, updateTeam: Partial<InsertTeam>): Promise<Team> {
    const { member_ids, ...teamData } = updateTeam;

    // Zuerst das Team abrufen, um den Ersteller zu überprüfen
    const [existingTeam] = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        companyId: teams.companyId,
        creatorId: teams.creatorId,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(eq(teams.id, id));

    if (!existingTeam) {
      throw new Error(`Team ${id} not found`);
    }

    // Überprüfen, ob der Benutzer der Ersteller des Teams ist
    if (existingTeam.creatorId !== userId) {
      throw new Error("Nur der Ersteller des Teams kann das Team bearbeiten");
    }

    const [team] = await db
      .update(teams)
      .set(teamData)
      .where(eq(teams.id, id))
      .returning();

    // Wenn member_ids im Update enthalten sind und der Benutzer der Ersteller ist,
    // dann aktualisiere die Teammitglieder
    if (member_ids) {
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.teamId, id));

      if (member_ids.length > 0) {
        const memberEntries = member_ids.map(memberId => ({
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

  async deleteTeam(userId: number, id: number): Promise<void> {
    // Zuerst das Team abrufen, um den Ersteller zu überprüfen
    const [existingTeam] = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        companyId: teams.companyId,
        creatorId: teams.creatorId,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(eq(teams.id, id));

    if (!existingTeam) {
      throw new Error(`Team ${id} not found`);
    }

    // Überprüfen, ob der Benutzer der Ersteller des Teams ist
    if (existingTeam.creatorId !== userId) {
      throw new Error("Nur der Ersteller des Teams kann das Team löschen");
    }

    // Erst Teammitglieder löschen
    await db
      .delete(teamMembers)
      .where(eq(teamMembers.teamId, id));

    // Dann das Team löschen
    const [team] = await db
      .delete(teams)
      .where(eq(teams.id, id))
      .returning();

    if (!team) {
      throw new Error(`Team ${id} not found`);
    }
  }
  // Team member operations
  async getTeamMembers(userId: number): Promise<TeamMember[]> {
    // Get user's company first
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.companyId) {
      return [];
    }

    // Get all teams from the user's company
    const companyTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        companyId: teams.companyId,
        creatorId: teams.creatorId,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(eq(teams.companyId, user.companyId));

    // Get all team members for these teams
    const allTeamMembers = await db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        role: teamMembers.role
      })
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, companyTeams.map(t => t.id)));

    return allTeamMembers;
  }

  async toggleProjectFavorite(userId: number, id: number): Promise<Project> {
    try {
      if (!(await permissionService.canAccessProject(userId, id))) {
        throw new Error(`Project ${id} not found or unauthorized access`);
      }
      
      // Projekt abrufen
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));

      if (!project) {
        throw new Error(`Project ${id} not found`);
      }
      
      // Prüfen, ob das Projekt bereits als Favorit markiert ist
      const favorites = await db
        .select()
        .from(userFavoriteProjects)
        .where(and(
          eq(userFavoriteProjects.userId, userId),
          eq(userFavoriteProjects.projectId, id)
        ));
      
      const isFavorite = favorites.length > 0;
      
      if (isFavorite) {
        // Favorit entfernen
        await db
          .delete(userFavoriteProjects)
          .where(and(
            eq(userFavoriteProjects.userId, userId),
            eq(userFavoriteProjects.projectId, id)
          ));
      } else {
        // Als Favorit hinzufügen
        await db
          .insert(userFavoriteProjects)
          .values({
            userId: userId,
            projectId: id
          });
      }
      
      // Projekt mit aktualisiertem isFavorite-Status zurückgeben
      return {
        ...project,
        isFavorite: !isFavorite
      };
    } catch (error) {
      console.error('Error toggling project favorite:', error);
      throw error;
    }
  }

  async toggleBoardFavorite(userId: number, id: number): Promise<Board> {
    try {
      if (!(await permissionService.canAccessBoard(userId, id))) {
        throw new Error(`Board ${id} not found or unauthorized access`);
      }
      
      // Board abrufen
      const [board] = await db
        .select()
        .from(boards)
        .where(eq(boards.id, id));

      if (!board) {
        throw new Error(`Board ${id} not found`);
      }
      
      // Prüfen, ob das Board bereits als Favorit markiert ist
      const favorites = await db
        .select()
        .from(userFavoriteBoards)
        .where(and(
          eq(userFavoriteBoards.userId, userId),
          eq(userFavoriteBoards.boardId, id)
        ));
      
      const isFavorite = favorites.length > 0;
      
      if (isFavorite) {
        // Favorit entfernen
        await db
          .delete(userFavoriteBoards)
          .where(and(
            eq(userFavoriteBoards.userId, userId),
            eq(userFavoriteBoards.boardId, id)
          ));
      } else {
        // Als Favorit hinzufügen
        await db
          .insert(userFavoriteBoards)
          .values({
            userId: userId,
            boardId: id
          });
      }
      
      // Board mit aktualisiertem isFavorite-Status zurückgeben
      return {
        ...board,
        is_favorite: !isFavorite
      };
    } catch (error) {
      console.error('Error toggling board favorite:', error);
      throw error;
    }
  }

  async toggleObjectiveFavorite(userId: number, id: number): Promise<Objective> {
    try {
      if (!(await permissionService.canAccessObjective(userId, id))) {
        throw new Error(`Objective ${id} not found or unauthorized access`);
      }
      
      // Objective abrufen
      const [objective] = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, id));

      if (!objective) {
        throw new Error(`Objective ${id} not found`);
      }
      
      // Prüfen, ob das Objective bereits als Favorit markiert ist
      const favorites = await db
        .select()
        .from(userFavoriteObjectives)
        .where(and(
          eq(userFavoriteObjectives.userId, userId),
          eq(userFavoriteObjectives.objectiveId, id)
        ));
      
      const isFavorite = favorites.length > 0;
      
      if (isFavorite) {
        // Favorit entfernen
        await db
          .delete(userFavoriteObjectives)
          .where(and(
            eq(userFavoriteObjectives.userId, userId),
            eq(userFavoriteObjectives.objectiveId, id)
          ));
      } else {
        // Als Favorit hinzufügen
        await db
          .insert(userFavoriteObjectives)
          .values({
            userId: userId,
            objectiveId: id
          });
      }
      
      // Objective mit aktualisiertem isFavorite-Status zurückgeben
      return {
        ...objective,
        isFavorite: !isFavorite
      };
    } catch (error) {
      console.error('Error toggling objective favorite:', error);
      throw error;
    }
  }

  async createObjective(userId: number, insertObj: InsertObjective): Promise<Objective> {
    try {
      const [objective] = await db
        .insert(objectives)
        .values({
          ...insertObj,
          progress: 0,
          creatorId: insertObj.creatorId,
          userIds: insertObj.userIds || [],
          isFavorite: false
        })
        .returning();

      if (!objective) {
        throw new Error("Failed to create objective - no data returned");
      }

      return objective;
    } catch (error) {
      console.error("Error in createObjective:", error);
      throw error;
    }
  }

  // Company operations
  async getCompany(userId: number, id: number): Promise<Company> {
    try {
      // Berechtigungsprüfung für Unternehmen
      const canAccess = await this.permissionService.canAccessCompany(userId, id);
      if (!canAccess) {
        throw new Error(`Unternehmen ${id} nicht gefunden oder keine Zugriffsberechtigung`);
      }

      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, id));

      if (!company) {
        throw new Error(`Unternehmen ${id} nicht gefunden`);
      }

      return company;
    } catch (error) {
      console.error("Error in getCompany:", error);
      throw error;
    }
  }

  async getCurrentUserCompany(userId: number): Promise<Company | null> {
    try {
      console.log(`[storage] Fetching company for user ID: ${userId}`);
      
      if (!userId) {
        console.log("[storage] User ID is missing, returning null");
        return null;
      }

      // Benutzer mit CompanyId abrufen
      console.log(`[storage] Querying user with ID: ${userId}`);
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      console.log(`[storage] User query result:`, userResult);
      
      if (!userResult || userResult.length === 0) {
        console.log(`[storage] User with ID ${userId} not found`);
        return null;
      }
      
      const user = userResult[0];
      
      if (!user.companyId) {
        console.log(`[storage] User has no company ID assigned`);
        return null;
      }
      
      console.log(`[storage] User belongs to company ID: ${user.companyId}`);

      // Unternehmen des Benutzers abrufen
      console.log(`[storage] Querying company with ID: ${user.companyId}`);
      const companyResult = await db
        .select({
          id: companies.id,
          name: companies.name,
          description: companies.description,
          inviteCode: companies.inviteCode,
          createdAt: companies.createdAt
        })
        .from(companies)
        .where(eq(companies.id, user.companyId));
      
      console.log(`[storage] Company query result:`, companyResult);
      
      if (!companyResult || companyResult.length === 0) {
        console.log(`[storage] Company with ID ${user.companyId} not found`);
        return null;
      }
      
      const company = companyResult[0];
      console.log(`[storage] Returning company:`, company);
      
      // Stelle sicher, dass Felder im camelCase sind
      return company;
    } catch (error) {
      console.error("[storage] Error in getCurrentUserCompany:", error);
      // Wirf Fehler weiter, um im Endpunkt entsprechend zu reagieren
      throw new Error(`Fehler beim Abrufen des Unternehmens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCompanyMembers(userId: number, companyId: number): Promise<User[]> {
    try {
      // Berechtigungsprüfung für Unternehmen
      const canAccess = await this.permissionService.canAccessCompany(userId, companyId);
      if (!canAccess) {
        throw new Error(`Unternehmen ${companyId} nicht gefunden oder keine Zugriffsberechtigung`);
      }

      // Benutzer aus diesem Unternehmen abrufen (nur aktivierte Benutzer)
      const members = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email, 
          avatarUrl: users.avatarUrl,
          isCompanyAdmin: users.isCompanyAdmin,
          createdAt: users.createdAt
        })
        .from(users)
        .where(
          and(
            eq(users.companyId, companyId),
            eq(users.isActive, true) // Nur aktivierte Benutzer anzeigen
          )
        );

      return members;
    } catch (error) {
      console.error("Error in getCompanyMembers:", error);
      throw error;
    }
  }

  async updateUserCompanyRole(userId: number, targetUserId: number, isAdmin: boolean): Promise<User> {
    try {
      // Prüfen, ob der Benutzer ein Admin ist
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!currentUser || !currentUser.companyId || !currentUser.isCompanyAdmin) {
        throw new Error("Nur Unternehmensadministratoren können Rollen ändern");
      }

      // Prüfen, ob der Zielbenutzer im selben Unternehmen ist
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId));

      if (!targetUser || targetUser.companyId !== currentUser.companyId) {
        throw new Error("Zielbenutzer nicht gefunden oder nicht im selben Unternehmen");
      }
      
      // Prüfen, ob der Benutzer aktiviert ist
      if (!targetUser.isActive) {
        throw new Error("Benutzer muss erst aktiviert werden, bevor er zum Administrator gemacht werden kann");
      }

      // Rolle aktualisieren
      const [updatedUser] = await db
        .update(users)
        .set({ isCompanyAdmin: isAdmin })
        .where(eq(users.id, targetUserId))
        .returning();

      return updatedUser;
    } catch (error) {
      console.error("Error in updateUserCompanyRole:", error);
      throw error;
    }
  }

  async generateCompanyInviteCode(userId: number, companyId: number): Promise<string> {
    try {
      // Prüfen, ob der Benutzer ein Admin ist
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!currentUser || !currentUser.companyId || !currentUser.isCompanyAdmin) {
        throw new Error("Nur Unternehmensadministratoren können Einladungscodes generieren");
      }

      if (currentUser.companyId !== companyId) {
        throw new Error("Sie können nur für Ihr eigenes Unternehmen Einladungscodes generieren");
      }

      // Einen eindeutigen Einladungscode generieren
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      // Einladungscode aktualisieren
      const [updatedCompany] = await db
        .update(companies)
        .set({ inviteCode })
        .where(eq(companies.id, companyId))
        .returning();

      return updatedCompany.inviteCode;
    } catch (error) {
      console.error("Error in generateCompanyInviteCode:", error);
      throw error;
    }
  }

  async joinCompanyWithInviteCode(userId: number, inviteCode: string): Promise<Company> {
    try {
      // Unternehmen mit diesem Einladungscode finden
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.inviteCode, inviteCode));

      if (!company) {
        throw new Error("Ungültiger Einladungscode");
      }

      // Benutzer aktualisieren
      const [updatedUser] = await db
        .update(users)
        .set({ companyId: company.id })
        .where(eq(users.id, userId))
        .returning();

      return company;
    } catch (error) {
      console.error("Error in joinCompanyWithInviteCode:", error);
      throw error;
    }
  }
  
  async createCompany(userId: number, companyData: InsertCompany): Promise<Company> {
    try {
      // Prüfen, ob der Benutzer eine ausreichende Abonnementstufe für Unternehmenserstellung hat
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        throw new Error("Benutzer nicht gefunden");
      }
      
      // Überprüfen Sie die Abonnementstufe des Benutzers
      if (user.subscriptionTier === "free") {
        throw new Error("Die Erstellung eines Unternehmens erfordert mindestens ein Basic-Abonnement");
      }
      
      // Prüfen, ob der Benutzer bereits einem anderen Unternehmen angehört
      if (user.companyId) {
        throw new Error("Sie sind bereits Mitglied eines Unternehmens");
      }
      
      // Einen eindeutigen Einladungscode generieren
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      // Unternehmen erstellen
      const [company] = await db
        .insert(companies)
        .values({
          name: companyData.name,
          description: companyData.description || null,
          inviteCode: inviteCode || companyData.inviteCode
        })
        .returning();
      
      if (!company) {
        throw new Error("Fehler beim Erstellen des Unternehmens");
      }
      
      // Benutzer als Unternehmensadmin setzen
      await db
        .update(users)
        .set({
          companyId: company.id,
          isCompanyAdmin: true
        })
        .where(eq(users.id, userId))
        .execute();
      
      return company;
    } catch (error) {
      console.error("Error in createCompany:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();