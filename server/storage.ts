import { tasks, boards, columns, comments, checklistItems, activityLogs, type Task, type InsertTask, type UpdateTask, type Board, type InsertBoard, type UpdateBoard, type Column, type InsertColumn, type Comment, type InsertComment, type ChecklistItem, type InsertChecklistItem, type ActivityLog, type InsertActivityLog } from "@shared/schema";
import { users, type User, type InsertUser } from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, gte, inArray, sql, type SQL, isNull, or } from "drizzle-orm";
import { teams, teamMembers, type Team, type InsertTeam, type TeamMember, type InsertTeamMember } from "@shared/schema";
import { projects, type Project, type InsertProject, type UpdateProject } from "@shared/schema";
import { userProductivityMetrics, taskStateChanges, taskTimeEntries, type UserProductivityMetrics, type TaskStateChange, type TaskTimeEntry, type InsertUserProductivityMetrics, type InsertTaskStateChange, type InsertTaskTimeEntry } from "@shared/schema";
import { objectives, type Objective, type InsertObjective } from "@shared/schema";
import { userFavoriteProjects, userFavoriteBoards, userFavoriteObjectives, type UserFavoriteProject, type UserFavoriteBoard, type UserFavoriteObjective } from "@shared/schema";
import { companies, type Company, type InsertCompany, type CompanyResponse } from "@shared/schema";
import { meetingProtocols, type MeetingProtocol, type InsertMeetingProtocol } from "@shared/schema";
import { permissionService } from "./permissions";
import { subscriptionService } from "./subscription-service";


export interface IStorage {
  // Meeting Protocol operations
  getMeetingProtocolsByTeam(userId: number, teamId: number): Promise<MeetingProtocol[]>;
  getMeetingProtocolsByProject(userId: number, projectId: number): Promise<MeetingProtocol[]>;
  getMeetingProtocolsByObjective(userId: number, objectiveId: number): Promise<MeetingProtocol[]>;
  getMeetingProtocol(userId: number, id: number): Promise<MeetingProtocol>;
  createMeetingProtocol(userId: number, protocol: InsertMeetingProtocol): Promise<MeetingProtocol>;
  updateMeetingProtocol(userId: number, id: number, protocol: Partial<InsertMeetingProtocol>): Promise<MeetingProtocol>;
  deleteMeetingProtocol(userId: number, id: number): Promise<void>;

  // Project operations
  getProjects(userId: number): Promise<Project[]>;
  getProject(userId: number, id: number): Promise<Project>;
  createProject(userId: number, project: InsertProject): Promise<Project>;
  updateProject(userId: number, id: number, project: UpdateProject): Promise<Project>;
  deleteProject(userId: number, id: number): Promise<void>;
  archiveProject(userId: number, id: number): Promise<Project>;
  unarchiveProject(userId: number, id: number): Promise<Project>;

  // Board operations
  getBoards(userId: number): Promise<Board[]>;
  getBoardsByProject(userId: number, projectId: number): Promise<Board[]>;
  getBoard(userId: number, id: number): Promise<Board>;
  createBoard(userId: number, board: InsertBoard): Promise<Board>;
  updateBoard(userId: number, id: number, board: UpdateBoard): Promise<Board>;
  deleteBoard(userId: number, id: number): Promise<void>;
  archiveBoard(userId: number, id: number): Promise<Board>;
  unarchiveBoard(userId: number, id: number): Promise<Board>;

  // Column operations
  getColumns(userId: number, boardId: number): Promise<Column[]>;
  createColumn(userId: number, column: InsertColumn): Promise<Column>;
  updateColumn(userId: number, id: number, column: Partial<InsertColumn>): Promise<Column>;
  deleteColumn(userId: number, id: number): Promise<void>;

  // Task operations
  getTasks(userId: number, boardId: number): Promise<Task[]>;
  getUserAssignedTasks(userId: number): Promise<Task[]>;
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
  createActivityLog(log: InsertActivityLog | any): Promise<ActivityLog>;
  
  // Productivity metrics operations
  getTaskDistribution(userId: number): Promise<{ name: string; value: number; }[]>;
  getProjectActivities(userId: number): Promise<{ name: string; tasks: number; }[]>;
  
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

// Wir verwenden eine Getter-Methode für permissionService und subscriptionService, 
// um zirkuläre Abhängigkeiten zu vermeiden
export class DatabaseStorage implements IStorage {
  private _permissionService?: typeof permissionService;
  private _subscriptionService?: typeof subscriptionService;
  
  get permissionService() {
    if (!this._permissionService) {
      this._permissionService = permissionService;
    }
    return this._permissionService;
  }
  
  get subscriptionService() {
    if (!this._subscriptionService) {
      this._subscriptionService = subscriptionService;
    }
    return this._subscriptionService;
  }
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
      // DEBUG: Log zum Überprüfen der Funktion
      console.log("Starting permission check for projects, total projects:", projectResults.length);
      
      const accessibleProjectsPromises = projectResults.map(async (project) => {
        // KORRIGIERT: Verwende this.permissionService statt permissionService
        const hasAccess = await this.permissionService.canAccessProject(userId, project.id);
        console.log(`Project ${project.id} (${project.title}) permission check result:`, {hasAccess});
        
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
      if (!project || !(await this.permissionService.canAccessProject(userId, id))) {
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
      
      // Mitglieder des Projekts laden, falls vorhanden
      let members = [];
      if (project.memberIds && project.memberIds.length > 0) {
        members = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl
          })
          .from(users)
          .where(inArray(users.id, project.memberIds));
      }
      
      // Creator des Projekts laden
      let creator = null;
      if (project.creator_id) {
        const [creatorUser] = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl
          })
          .from(users)
          .where(eq(users.id, project.creator_id));
          
        creator = creatorUser;
      }
      
      // Personalisierter Favoriten-Status basierend auf userFavoriteProjects
      return {
        ...project,
        isFavorite: favorite ? true : false,
        members: members,
        creator: creator
      };
    } catch (error) {
      console.error("Error in getProject:", error);
      throw error;
    }
  }

  async createProject(userId: number, insertProject: InsertProject): Promise<Project> {
    // Stelle sicher, dass creator_id gesetzt ist
    const projectData = {
      ...insertProject,
      creator_id: userId,
    };
    
    const [project] = await db
      .insert(projects)
      .values(projectData)
      .returning();
    return project;
  }

  async updateProject(userId: number, id: number, updateProject: UpdateProject): Promise<Project> {
    if (!(await this.permissionService.canAccessProject(userId, id))) {
      throw new Error(`Project ${id} not found or unauthorized access`);
    }
    const projectData = {
      ...updateProject,
      teamIds: Array.isArray(updateProject.teamIds) ? updateProject.teamIds : [],
      memberIds: Array.isArray(updateProject.memberIds) ? updateProject.memberIds : [],
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

    // Aktualisiertes Projekt mit Mitgliedern holen
    return this.getProject(userId, id);
  }

  async deleteProject(userId: number, id: number): Promise<void> {
    if (!(await this.permissionService.canAccessProject(userId, id))) {
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

  async archiveProject(userId: number, id: number): Promise<Project> {
    if (!(await this.permissionService.canAccessProject(userId, id))) {
      throw new Error(`Project ${id} not found or unauthorized access`);
    }
    
    // Projekt archivieren
    const [project] = await db
      .update(projects)
      .set({ archived: true })
      .where(eq(projects.id, id))
      .returning();

    if (!project) {
      throw new Error(`Project ${id} not found`);
    }

    // Aktivitätslog erstellen
    await this.createActivityLog({
      action: "update",
      details: `Projekt "${project.title}" wurde archiviert`,
      userId: userId,
      projectId: id,
      requiresNotification: true,
      notificationType: "project"
    });

    // Aktualisiertes Projekt zurückgeben
    return this.getProject(userId, id);
  }

  async unarchiveProject(userId: number, id: number): Promise<Project> {
    if (!(await this.permissionService.canAccessProject(userId, id))) {
      throw new Error(`Project ${id} not found or unauthorized access`);
    }
    
    // Projekt wiederherstellen
    const [project] = await db
      .update(projects)
      .set({ archived: false })
      .where(eq(projects.id, id))
      .returning();

    if (!project) {
      throw new Error(`Project ${id} not found`);
    }

    // Aktivitätslog erstellen
    await this.createActivityLog({
      action: "update",
      details: `Projekt "${project.title}" wurde wiederhergestellt`,
      userId: userId,
      projectId: id,
      requiresNotification: true,
      notificationType: "project"
    });

    // Aktualisiertes Projekt zurückgeben
    return this.getProject(userId, id);
  }

  // Board operations
  async getBoards(userId: number): Promise<Board[]> {
    try {
      console.log("Fetching boards for user:", userId);
      
      // Prüfe zuerst, ob der Benutzer ein Hyper-Admin ist
      const isHyperAdmin = await this.permissionService.isHyperAdmin(userId);
      console.log(`User ${userId} is Hyper-Admin: ${isHyperAdmin}`);
      
      // Benutzerinformationen abrufen
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      // Alle Boards abrufen
      const boardResults = await db.select().from(boards);
      
      // Hole alle Team-IDs des Benutzers für die Berechtigungsprüfung
      const userTeams = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId));
      
      const userTeamIds = userTeams.map(tm => tm.teamId);
      console.log(`User ${userId} is a member of teams:`, userTeamIds);
      
      // Filtere Boards basierend auf tatsächlichen Zugriffsrechten
      const filteredBoardResults = boardResults.filter(board => {
        // Wenn Benutzer HyperAdmin ist, zeige alle Boards
        if (isHyperAdmin === true) return true;
        
        // Board-Ersteller kann immer sein eigenes Board sehen
        if (board.creator_id === userId) {
          console.log(`Board ${board.id}: User ${userId} is creator - access granted`);
          return true;
        }
        
        // Direkt zugewiesene Benutzer können das Board sehen
        if (board.assigned_user_ids?.includes(userId)) {
          console.log(`Board ${board.id}: User ${userId} is directly assigned - access granted`);
          return true;
        }
        
        // Prüfe Team-Mitgliedschaft für Team-Zuweisungen an Board
        if (board.team_ids && board.team_ids.some(teamId => userTeamIds.includes(teamId))) {
          console.log(`Board ${board.id}: User ${userId} is member of an assigned team - access granted`);
          return true;
        }
        
        // Andernfalls Board ausblenden
        console.log(`Board ${board.id}: User ${userId} has no access`);
        return false;
      });

      // Favoriten für diesen Benutzer abrufen
      const favoriteBoards = await db
        .select()
        .from(userFavoriteBoards)
        .where(eq(userFavoriteBoards.userId, userId));
      
      // Set mit Favoriten-Board-IDs erstellen für schnelle Suche
      const favoriteBoardIds = new Set(favoriteBoards.map(fb => fb.boardId));
      
      console.log(`User ${userId} has ${filteredBoardResults.length} accessible boards`);

      // Wir brauchen keine weitere Berechtigungsprüfung, da wir bereits gefiltert haben
      const accessibleBoardsPromises = filteredBoardResults.map(async (board) => {
        // Personalisierter Favoriten-Status basierend auf userFavoriteBoards
        return {
          ...board,
          is_favorite: favoriteBoardIds.has(board.id)
        };
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
      
      // Prüfe zuerst, ob der Benutzer ein Hyper-Admin ist
      const isHyperAdmin = await this.permissionService.isHyperAdmin(userId);
      console.log(`User ${userId} is Hyper-Admin: ${isHyperAdmin}`);
      
      // Prüfe, ob der Benutzer Zugriff auf das Projekt hat
      const hasProjectAccess = await this.permissionService.canAccessProject(userId, projectId);
      if (!hasProjectAccess && !isHyperAdmin) {
        console.log(`User ${userId} has no access to project ${projectId}`);
        return [];
      }
      
      // Alle Boards des Projekts abrufen
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
      
      // Hole alle Team-IDs des Benutzers für die Berechtigungsprüfung
      const userTeams = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId));
      
      const userTeamIds = userTeams.map(tm => tm.teamId);
      console.log(`User ${userId} is a member of teams:`, userTeamIds);
      
      // Filtere Boards basierend auf tatsächlichen Zugriffsrechten
      let filteredBoards = boardResults;
      if (!isHyperAdmin) {
        filteredBoards = boardResults.filter(board => {
          // Ersteller kann immer seine eigenen Boards sehen
          if (board.creator_id === userId) {
            console.log(`Board ${board.id}: User ${userId} is creator - access granted`);
            return true;
          }
          
          // Direkt zugewiesene Benutzer können das Board sehen
          if (board.assigned_user_ids?.includes(userId)) {
            console.log(`Board ${board.id}: User ${userId} is directly assigned - access granted`);
            return true;
          }
          
          // Prüfe Team-Mitgliedschaft für Team-Zuweisungen an Board
          if (board.team_ids && board.team_ids.some(teamId => userTeamIds.includes(teamId))) {
            console.log(`Board ${board.id}: User ${userId} is member of an assigned team - access granted`);
            return true;
          }
          
          // Andernfalls Board ausblenden
          console.log(`Board ${board.id}: User ${userId} has no access`);
          return false;
        });
      }
      
      // Berechtigungsprüfung für alle Boards
      const accessibleBoardsPromises = filteredBoards.map(async (board) => {
        const hasAccess = await this.permissionService.canAccessBoard(userId, board.id);
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

      if (!board || !(await this.permissionService.canAccessBoard(userId, id))) {
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
      if (!(await this.permissionService.canAccessBoard(userId, id))) {
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
    if (!(await this.permissionService.canAccessBoard(userId, boardId))) {
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
    if (!(await this.permissionService.canAccessBoard(userId, id))) {
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

  async archiveBoard(userId: number, id: number): Promise<Board> {
    if (!(await this.permissionService.canAccessBoard(userId, id))) {
      throw new Error(`Board ${id} not found or unauthorized access`);
    }
    
    // Board archivieren
    const [board] = await db
      .update(boards)
      .set({ archived: true })
      .where(eq(boards.id, id))
      .returning();

    if (!board) {
      throw new Error(`Board ${id} not found`);
    }

    // Aktivitätslog erstellen
    await this.createActivityLog({
      action: "update",
      details: `Board "${board.title}" wurde archiviert`,
      userId: userId,
      boardId: id,
      requiresNotification: true,
      notificationType: "board"
    });

    // Aktualisiertes Board zurückgeben
    return this.getBoard(userId, id);
  }

  async unarchiveBoard(userId: number, id: number): Promise<Board> {
    if (!(await this.permissionService.canAccessBoard(userId, id))) {
      throw new Error(`Board ${id} not found or unauthorized access`);
    }
    
    // Board wiederherstellen
    const [board] = await db
      .update(boards)
      .set({ archived: false })
      .where(eq(boards.id, id))
      .returning();

    if (!board) {
      throw new Error(`Board ${id} not found`);
    }

    // Aktivitätslog erstellen
    await this.createActivityLog({
      action: "update",
      details: `Board "${board.title}" wurde wiederhergestellt`,
      userId: userId,
      boardId: id,
      requiresNotification: true,
      notificationType: "board"
    });

    // Aktualisiertes Board zurückgeben
    return this.getBoard(userId, id);
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
    return this.permissionService.filterBoardMembers(userId, members);
  }


  // Column operations
  async getColumns(userId: number, boardId: number): Promise<Column[]> {
    const columnsData = await db
      .select()
      .from(columns)
      .where(eq(columns.boardId, boardId))
      .orderBy(columns.order);
    return this.permissionService.filterColumns(userId, columnsData);
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
    // Verwenden einer direkten SQL-Abfrage, um auch die Benutzerinformationen für die Aufgaben zu bekommen
    const result = await pool.query(`
      SELECT t.*, 
        ARRAY_AGG(DISTINCT JSONB_BUILD_OBJECT(
          'id', u.id, 
          'username', u.username, 
          'avatarUrl', u.avatar_url
        )) FILTER (WHERE u.id IS NOT NULL) AS assigned_users
      FROM tasks t
      LEFT JOIN users u ON u.id = ANY(t.assigned_user_ids)
      WHERE t.board_id = $1
      GROUP BY t.id
      ORDER BY t."order"
    `, [boardId]);
    
    // Wandle die Postgres-Ergebnisse in unser gewünschtes Format um
    return result.rows.map(task => {
      // Extrahiere die zugewiesenen Benutzer aus dem aggregierten Feld
      const assignedUsers = task.assigned_users || [];
      
      return {
        id: task.id,
        title: task.title,
        description: task.description,
        richDescription: task.rich_description,
        status: task.status,
        order: task.order,
        boardId: task.board_id,
        columnId: task.column_id,
        priority: task.priority,
        labels: Array.isArray(task.labels) ? task.labels : [],
        startDate: task.start_date,
        dueDate: task.due_date,
        archived: task.archived,
        assignedUserIds: Array.isArray(task.assigned_user_ids) ? task.assigned_user_ids : [],
        assignedTeamId: task.assigned_team_id,
        assignedAt: task.assigned_at,
        attachments: Array.isArray(task.attachments) ? task.attachments : [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        checklist: Array.isArray(task.checklist) ? task.checklist : [],
        // Füge die Benutzerinformationen hinzu
        assignedUsers: assignedUsers,
      };
    });
  }
  
  async getUserAssignedTasks(userId: number): Promise<Task[]> {
    try {
      console.log(`Fetching tasks assigned to user: ${userId}`);
      
      // Rufe alle Tasks ab, die dem Benutzer zugewiesen sind (inkl. archivierte Tasks) und hole auch die Benutzerinformationen
      // Verwende den ANY Operator, um einen Integer in einem Integer-Array zu finden
      const result = await pool.query(`
        SELECT t.*, 
          ARRAY_AGG(DISTINCT JSONB_BUILD_OBJECT(
            'id', u.id, 
            'username', u.username, 
            'avatarUrl', u.avatar_url
          )) FILTER (WHERE u.id IS NOT NULL) AS assigned_users
        FROM tasks t
        LEFT JOIN users u ON u.id = ANY(t.assigned_user_ids)
        WHERE $1 = ANY(t.assigned_user_ids)
        GROUP BY t.id
        ORDER BY t.board_id NULLS FIRST, t.column_id NULLS FIRST, t."order"
      `, [userId]);
      
      const userTasks = result.rows;
      console.log(`Found ${userTasks.length} tasks assigned to user ${userId}`);
      
      // Für jeden Task Zusatzinformationen abrufen (Board, Spalte, Projekt)
      const enrichedTasks = await Promise.all(userTasks.map(async (task) => {
        // Konvertiere Postgres-Arrays zu JavaScript-Arrays
        const checklist = Array.isArray(task.checklist) ? task.checklist : [];
        const assignedUserIds = Array.isArray(task.assigned_user_ids) ? task.assigned_user_ids : [];
        const labels = Array.isArray(task.labels) ? task.labels : [];
        const attachments = Array.isArray(task.attachments) ? task.attachments : [];
        // Extrahiere die zugewiesenen Benutzer aus dem aggregierten Feld
        const assignedUsers = task.assigned_users || [];
        
        let board = null;
        let column = null;
        let project = null;
        
        // Board und Spalte nur abrufen, wenn es sich nicht um eine persönliche Aufgabe handelt
        if (task.board_id !== null) {
          // Board abrufen, zu dem der Task gehört
          const [boardData] = await db
            .select({
              id: boards.id,
              title: boards.title,
              projectId: boards.project_id,
            })
            .from(boards)
            .where(eq(boards.id, task.board_id));
          
          board = boardData;
          
          // Spalte abrufen, wenn eine vorhanden ist
          if (task.column_id !== null) {
            const [columnData] = await db
              .select({
                id: columns.id,
                title: columns.title,
              })
              .from(columns)
              .where(eq(columns.id, task.column_id));
              
            column = columnData;
          }
          
          // Projekt abrufen, falls das Board zu einem Projekt gehört
          if (board && board.projectId) {
            const [projectData] = await db
              .select({
                id: projects.id,
                title: projects.title,
              })
              .from(projects)
              .where(eq(projects.id, board.projectId));
              
            project = projectData;
          }
        }
        
        // Zugewiesener Benutzer, falls vorhanden (für Abwärtskompatibilität)
        let assignedUser = null;
        if (assignedUserIds.includes(userId)) {
          const userData = assignedUsers.find(u => u.id === userId);
          if (userData) {
            assignedUser = {
              id: userData.id,
              username: userData.username,
              email: userData.email || "", // E-Mail ist möglicherweise nicht in assignedUsers enthalten
              avatarUrl: userData.avatarUrl,
            };
          }
        }
        
        // Task mit zusätzlichen Informationen zurückgeben
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          richDescription: task.rich_description,
          status: task.status,
          priority: task.priority,
          labels: labels,
          checklist: checklist,
          columnId: task.column_id,
          boardId: task.board_id,
          dueDate: task.due_date,
          order: task.order,
          assignedUserIds: assignedUserIds,
          assignedTeamId: task.assigned_team_id,
          archived: task.archived,
          attachments: attachments,
          board: board,
          column: column,
          project: project,
          assignedUser: assignedUser,
          assignedUsers: assignedUsers,
          // Markiere persönliche Aufgaben
          isPersonal: task.board_id === null
        };
      }));

      // Prüfe Zugriffsberechtigung für jeden Task
      const accessibleTasks = await Promise.all(
        enrichedTasks.map(async (task) => {
          // Persönliche Aufgaben sind immer für den Benutzer zugänglich
          if (task.boardId === null) {
            return task;
          }
          
          // Prüfe, ob der Benutzer Zugriff auf das Board hat
          const hasAccess = await this.permissionService.canAccessBoard(userId, task.boardId);
          return hasAccess ? task : null;
        })
      );

      // Filtere Tasks ohne Zugriffsberechtigung heraus
      return accessibleTasks.filter((task): task is Task => task !== null);
    } catch (error) {
      console.error("Error in getUserAssignedTasks:", error);
      throw error;
    }
  }

  async createTask(userId: number, insertTask: InsertTask): Promise<Task> {
    // Stelle sicher, dass der Ersteller immer in den zugewiesenen Benutzern enthalten ist
    let assignedUserIds = [...(insertTask.assignedUserIds || [])];
    if (!assignedUserIds.includes(userId)) {
      assignedUserIds.push(userId);
    }
    
    const [task] = await db
      .insert(tasks)
      .values({
        ...insertTask,
        checklist: insertTask.checklist || [],
        assignedUserIds: assignedUserIds,
      })
      .returning();

    // Benutzerinformationen für die zugewiesenen Benutzer holen
    const usersResult = await db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, assignedUserIds));

    return {
      ...task,
      checklist: Array.isArray(task.checklist) ? task.checklist : [],
      assignedUserIds: Array.isArray(task.assignedUserIds) ? task.assignedUserIds : [],
      assignedUsers: usersResult,
    };
  }

  async updateTask(userId: number, id: number, updateTask: UpdateTask): Promise<Task> {
    console.log("Aktualisiere Task mit ID:", id, "Anhänge:", updateTask.attachments);
    
    // Stelle sicher, dass der Ersteller immer in den zugewiesenen Benutzern enthalten ist
    // Sicherstellen, dass assignedUserIds ein Array ist
    let assignedUserIds = [];
    if (updateTask.assignedUserIds) {
      if (Array.isArray(updateTask.assignedUserIds)) {
        assignedUserIds = [...updateTask.assignedUserIds];
      } else if (typeof updateTask.assignedUserIds === 'string') {
        // Wenn ein String übergeben wird, konvertieren wir ihn in ein Array
        try {
          // Versuchen wir es als JSON zu parsen
          assignedUserIds = JSON.parse(updateTask.assignedUserIds);
        } catch (e) {
          // Wenn das nicht funktioniert, versuchen wir es als einzelne ID zu behandeln
          assignedUserIds = [parseInt(updateTask.assignedUserIds, 10)];
        }
      } else if (typeof updateTask.assignedUserIds === 'number') {
        // Einzelne Nummer als Array behandeln
        assignedUserIds = [updateTask.assignedUserIds];
      }
    }
    
    // Stelle sicher, dass der Ersteller immer enthalten ist
    if (!assignedUserIds.includes(userId)) {
      assignedUserIds.push(userId);
    }
    
    // Sicherstellen, dass alle Arrays korrekt formatiert sind für PostgreSQL
    let labels = [];
    if (updateTask.labels) {
      if (Array.isArray(updateTask.labels)) {
        labels = updateTask.labels;
      } else if (typeof updateTask.labels === 'string') {
        try {
          labels = JSON.parse(updateTask.labels);
        } catch (e) {
          labels = [updateTask.labels];
        }
      }
    }
    
    let checklist = [];
    if (updateTask.checklist) {
      if (Array.isArray(updateTask.checklist)) {
        checklist = updateTask.checklist;
      } else if (typeof updateTask.checklist === 'string') {
        try {
          checklist = JSON.parse(updateTask.checklist);
        } catch (e) {
          checklist = [updateTask.checklist];
        }
      }
    }
    
    let attachments = [];
    if (updateTask.attachments) {
      if (Array.isArray(updateTask.attachments)) {
        attachments = updateTask.attachments;
      } else if (typeof updateTask.attachments === 'string') {
        try {
          attachments = JSON.parse(updateTask.attachments);
        } catch (e) {
          attachments = [updateTask.attachments];
        }
      }
    }
    
    // Erstellen der bereinigten Daten für das Update
    const cleanedUpdateTask = {...updateTask};
    delete cleanedUpdateTask.assignedUserIds;
    delete cleanedUpdateTask.labels;
    delete cleanedUpdateTask.checklist;
    delete cleanedUpdateTask.attachments;
    
    const updatedData = {
      ...cleanedUpdateTask,
      labels: labels,
      checklist: checklist,
      assignedUserIds: assignedUserIds,
      attachments: attachments,
    };
    
    const [task] = await db
      .update(tasks)
      .set(updatedData)
      .where(eq(tasks.id, id))
      .returning();

    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    // Benutzerinformationen für die zugewiesenen Benutzer holen
    const usersResult = await db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(sql`${users.id} = ANY(${task.assignedUserIds})`);

    return {
      ...task,
      checklist: Array.isArray(task.checklist) ? task.checklist : [],
      assignedUserIds: Array.isArray(task.assignedUserIds) ? task.assignedUserIds : [],
      attachments: Array.isArray(task.attachments) ? task.attachments : [],
      assignedUsers: usersResult || [],
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
    return this.permissionService.filterComments(userId, commentsData);
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
    return this.permissionService.filterChecklistItems(userId, checklistItemsData);
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
    return await this.permissionService.getVisibleActivityLogs(userId);
  }

  async createActivityLog(log: InsertActivityLog | any): Promise<ActivityLog> {
    try {
      // Verwende query statt Drizzle ORM, um Probleme mit Spalten zu vermeiden
      const values = [
        log.action,
        log.details || null,
        log.userId || null,
        log.boardId || null,
        log.projectId || null,
        log.objectiveId || null,
        log.taskId || null,
        log.teamId || null,
        log.targetUserId || null,
        log.requiresNotification || false,
        log.notificationSent || false,
        log.notificationType || null
      ];
      
      console.log("Creating activity log with:", log);
      
      const result = await pool.query(`
        INSERT INTO activity_logs 
        (action, details, user_id, board_id, project_id, objective_id, task_id, team_id, target_user_id, requires_notification, notification_sent, notification_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *
      `, values);
      
      const newLog = result.rows[0];

      return newLog;
    } catch (error) {
      console.error("Error creating activity log:", error);
      throw error;
    }
  }

  // User operations
  async getUser(userId: number, id: number): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user || !(await this.permissionService.canAccessUser(userId, id))) {
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
    if (!(await this.permissionService.canAccessUser(userId, id))) {
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
    if (!(await this.permissionService.canAccessUser(userId, id))) {
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
    if (!(await this.permissionService.canAccessUser(userId, id))) {
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
    return this.permissionService.filterUsers(userId, usersData);
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
  
  async updateOrCreateDailyProductivityMetrics(userId: number, update: { 
    tasksCreated?: number, 
    tasksCompleted?: number 
  }): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Setze auf Tagesbeginn
    
    // Prüfe, ob es bereits einen Eintrag für heute gibt
    const existingMetrics = await db
      .select()
      .from(userProductivityMetrics)
      .where(
        and(
          eq(userProductivityMetrics.userId, userId),
          sql`DATE(${userProductivityMetrics.date}) = DATE(${today})`
        )
      );
    
    if (existingMetrics.length > 0) {
      // Update des vorhandenen Eintrags
      const current = existingMetrics[0];
      await db
        .update(userProductivityMetrics)
        .set({
          tasksCreated: update.tasksCreated !== undefined 
            ? (current.tasksCreated || 0) + update.tasksCreated 
            : current.tasksCreated,
          tasksCompleted: update.tasksCompleted !== undefined 
            ? (current.tasksCompleted || 0) + update.tasksCompleted 
            : current.tasksCompleted
        })
        .where(eq(userProductivityMetrics.id, current.id));
    } else {
      // Neuen Eintrag erstellen
      await db
        .insert(userProductivityMetrics)
        .values({
          userId,
          date: today.toISOString(),
          tasksCreated: update.tasksCreated || 0,
          tasksCompleted: update.tasksCompleted || 0,
          timeSpentMinutes: 0,
          objectivesAchieved: 0
        });
    }
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
  
  async getProjectActivities(userId: number): Promise<{ name: string; tasks: number; }[]> {
    const result = await db.execute<{ name: string; tasks: number; }>(sql`
      WITH user_tasks AS (
        SELECT 
          t.id,
          t.board_id,
          b.project_id,
          p.title as project_name
        FROM tasks t
        LEFT JOIN boards b ON t.board_id = b.id
        LEFT JOIN projects p ON b.project_id = p.id
        WHERE t.assigned_user_ids @> ARRAY[${userId}]::int[]
      )
      SELECT 
        COALESCE(project_name, 'Ohne Projekt') as name, 
        COUNT(id) as tasks
      FROM user_tasks
      GROUP BY project_name
      ORDER BY tasks DESC
      LIMIT 5
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
    
    return this.permissionService.filterTeams(userId, teamsData);
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

    if (!team || !(await this.permissionService.canAccessTeam(userId, id))) {
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
      if (!(await this.permissionService.canAccessProject(userId, id))) {
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
      if (!(await this.permissionService.canAccessBoard(userId, id))) {
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
      if (!(await this.permissionService.canAccessObjective(userId, id))) {
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
      // Stelle sicher, dass der Ersteller auch in den userIds enthalten ist
      let userIds = insertObj.userIds || [];
      if (!userIds.includes(userId) && userId) {
        userIds = [...userIds, userId];
      }
      
      const [objective] = await db
        .insert(objectives)
        .values({
          ...insertObj,
          progress: 0,
          creatorId: insertObj.creatorId,
          userIds: userIds,
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

  // Meeting Protocol operations
  async getMeetingProtocolsByTeam(userId: number, teamId: number): Promise<MeetingProtocol[]> {
    try {
      console.log(`Fetching meeting protocols for team ${teamId} and user ${userId}`);
      
      // Prüfen, ob der Benutzer Zugriff auf das Team hat
      if (!(await this.permissionService.canAccessTeam(userId, teamId))) {
        throw new Error(`Team ${teamId} not found or unauthorized access`);
      }
      
      // Protokolle für dieses Team abrufen
      const protocolResults = await db
        .select()
        .from(meetingProtocols)
        .where(eq(meetingProtocols.teamId, teamId))
        .orderBy(desc(meetingProtocols.date));

      // Erweiterte Informationen für jedes Protokoll abrufen (z.B. Ersteller-Details)
      const processedProtocols = await Promise.all(protocolResults.map(async (protocol) => {
        // Ersteller-Informationen abrufen
        const [creator] = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl
          })
          .from(users)
          .where(eq(users.id, protocol.creatorId));

        // Teilnehmer-Informationen abrufen, wenn vorhanden
        let participants = [];
        if (protocol.participants && protocol.participants.length > 0) {
          const participantIds = protocol.participants.map(p => parseInt(p));
          participants = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              avatarUrl: users.avatarUrl
            })
            .from(users)
            .where(inArray(users.id, participantIds));
        }
        
        // Team-Teilnehmer abrufen, wenn vorhanden
        let teamParticipantDetails = [];
        if (protocol.teamParticipants && protocol.teamParticipants.length > 0) {
          teamParticipantDetails = await db
            .select({
              id: teams.id,
              name: teams.name,
              description: teams.description
            })
            .from(teams)
            .where(inArray(teams.id, protocol.teamParticipants));
        }

        return {
          ...protocol,
          creator,
          participantDetails: participants,
          teamParticipantDetails
        };
      }));

      return processedProtocols;
    } catch (error) {
      console.error("Error in getMeetingProtocolsByTeam:", error);
      throw error;
    }
  }

  async getMeetingProtocolsByProject(userId: number, projectId: number): Promise<MeetingProtocol[]> {
    try {
      console.log(`Fetching meeting protocols for project ${projectId} and user ${userId}`);
      
      // Prüfen, ob der Benutzer Zugriff auf das Projekt hat
      if (!(await this.permissionService.canAccessProject(userId, projectId))) {
        throw new Error(`Project ${projectId} not found or unauthorized access`);
      }
      
      // Protokolle für dieses Projekt abrufen
      const protocolResults = await db
        .select()
        .from(meetingProtocols)
        .where(eq(meetingProtocols.projectId, projectId))
        .orderBy(desc(meetingProtocols.date));

      // Erweiterte Informationen für jedes Protokoll abrufen
      const processedProtocols = await Promise.all(protocolResults.map(async (protocol) => {
        // Ersteller-Informationen abrufen
        const [creator] = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl
          })
          .from(users)
          .where(eq(users.id, protocol.creatorId));

        // Teilnehmer-Informationen abrufen, wenn vorhanden
        let participants = [];
        if (protocol.participants && protocol.participants.length > 0) {
          const participantIds = protocol.participants.map(p => parseInt(p));
          participants = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              avatarUrl: users.avatarUrl
            })
            .from(users)
            .where(inArray(users.id, participantIds));
        }
        
        // Team-Teilnehmer abrufen, wenn vorhanden
        let teamParticipantDetails = [];
        if (protocol.teamParticipants && protocol.teamParticipants.length > 0) {
          teamParticipantDetails = await db
            .select({
              id: teams.id,
              name: teams.name,
              description: teams.description
            })
            .from(teams)
            .where(inArray(teams.id, protocol.teamParticipants));
        }

        return {
          ...protocol,
          creator,
          participantDetails: participants,
          teamParticipantDetails
        };
      }));

      return processedProtocols;
    } catch (error) {
      console.error("Error in getMeetingProtocolsByProject:", error);
      throw error;
    }
  }

  async getMeetingProtocolsByObjective(userId: number, objectiveId: number): Promise<MeetingProtocol[]> {
    try {
      console.log(`Fetching meeting protocols for objective ${objectiveId} and user ${userId}`);
      
      // Prüfen, ob der Benutzer Zugriff auf das Objective hat
      if (!(await this.permissionService.canAccessObjective(userId, objectiveId))) {
        throw new Error(`Objective ${objectiveId} not found or unauthorized access`);
      }
      
      // Protokolle für dieses Objective abrufen
      const protocolResults = await db
        .select()
        .from(meetingProtocols)
        .where(eq(meetingProtocols.objectiveId, objectiveId))
        .orderBy(desc(meetingProtocols.date));

      // Erweiterte Informationen für jedes Protokoll abrufen
      const processedProtocols = await Promise.all(protocolResults.map(async (protocol) => {
        // Ersteller-Informationen abrufen
        const [creator] = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl
          })
          .from(users)
          .where(eq(users.id, protocol.creatorId));

        // Teilnehmer-Informationen abrufen, wenn vorhanden
        let participants = [];
        if (protocol.participants && protocol.participants.length > 0) {
          const participantIds = protocol.participants.map(p => parseInt(p));
          participants = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              avatarUrl: users.avatarUrl
            })
            .from(users)
            .where(inArray(users.id, participantIds));
        }

        // Team-Teilnehmer abrufen, wenn vorhanden
        let teamParticipantDetails = [];
        if (protocol.teamParticipants && protocol.teamParticipants.length > 0) {
          teamParticipantDetails = await db
            .select({
              id: teams.id,
              name: teams.name,
              description: teams.description
            })
            .from(teams)
            .where(inArray(teams.id, protocol.teamParticipants));
        }

        return {
          ...protocol,
          creator,
          participantDetails: participants,
          teamParticipantDetails
        };
      }));

      return processedProtocols;
    } catch (error) {
      console.error("Error in getMeetingProtocolsByObjective:", error);
      throw error;
    }
  }

  async getMeetingProtocol(userId: number, id: number): Promise<MeetingProtocol> {
    try {
      console.log(`Fetching meeting protocol ${id} for user ${userId}`);
      
      // Protokoll abrufen
      const [protocol] = await db.select().from(meetingProtocols).where(eq(meetingProtocols.id, id));
      
      if (!protocol) {
        throw new Error(`Meeting protocol ${id} not found`);
      }
      
      // Berechtigungsprüfung basierend auf Team, Projekt oder Objective
      let hasAccess = false;
      
      if (protocol.teamId) {
        hasAccess = await this.permissionService.canAccessTeam(userId, protocol.teamId);
      } else if (protocol.projectId) {
        hasAccess = await this.permissionService.canAccessProject(userId, protocol.projectId);
      } else if (protocol.objectiveId) {
        hasAccess = await this.permissionService.canAccessObjective(userId, protocol.objectiveId);
      }
      
      if (!hasAccess) {
        throw new Error(`Unauthorized access to meeting protocol ${id}`);
      }
      
      // Ersteller-Informationen abrufen
      const [creator] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          avatarUrl: users.avatarUrl
        })
        .from(users)
        .where(eq(users.id, protocol.creatorId));
      
      // Teilnehmer-Informationen abrufen, wenn vorhanden
      let participants = [];
      if (protocol.participants && protocol.participants.length > 0) {
        const participantIds = protocol.participants.map(p => parseInt(p));
        participants = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            avatarUrl: users.avatarUrl
          })
          .from(users)
          .where(inArray(users.id, participantIds));
      }
      
      // Team-Teilnehmer abrufen, wenn vorhanden
      let teamParticipantDetails = [];
      if (protocol.teamParticipants && protocol.teamParticipants.length > 0) {
        teamParticipantDetails = await db
          .select({
            id: teams.id,
            name: teams.name,
            description: teams.description
          })
          .from(teams)
          .where(inArray(teams.id, protocol.teamParticipants));
      }
      
      return {
        ...protocol,
        creator,
        participantDetails: participants,
        teamParticipantDetails
      };
    } catch (error) {
      console.error("Error in getMeetingProtocol:", error);
      throw error;
    }
  }

  async createMeetingProtocol(userId: number, protocol: InsertMeetingProtocol): Promise<MeetingProtocol> {
    try {
      console.log(`Creating meeting protocol for user ${userId}`);
      
      // Berechtigungsprüfung basierend auf Team, Projekt oder Objective
      if (protocol.teamId && !(await this.permissionService.canAccessTeam(userId, protocol.teamId))) {
        throw new Error(`Team ${protocol.teamId} not found or unauthorized access`);
      } else if (protocol.projectId && !(await this.permissionService.canAccessProject(userId, protocol.projectId))) {
        throw new Error(`Project ${protocol.projectId} not found or unauthorized access`);
      } else if (protocol.objectiveId && !(await this.permissionService.canAccessObjective(userId, protocol.objectiveId))) {
        throw new Error(`Objective ${protocol.objectiveId} not found or unauthorized access`);
      }
      
      // Ersteller hinzufügen
      const protocolData = {
        ...protocol,
        creatorId: userId,
      };
      
      // Neues Protokoll erstellen
      const [newProtocol] = await db
        .insert(meetingProtocols)
        .values(protocolData)
        .returning();
      
      // Erstelles Protokoll mit Zusatzinformationen zurückgeben
      return this.getMeetingProtocol(userId, newProtocol.id);
    } catch (error) {
      console.error("Error in createMeetingProtocol:", error);
      throw error;
    }
  }

  async updateMeetingProtocol(userId: number, id: number, updateData: Partial<InsertMeetingProtocol>): Promise<MeetingProtocol> {
    try {
      console.log(`Updating meeting protocol ${id} for user ${userId}`);
      
      // Vorhandenes Protokoll abrufen und Berechtigung prüfen
      const [protocol] = await db.select().from(meetingProtocols).where(eq(meetingProtocols.id, id));
      
      if (!protocol) {
        throw new Error(`Meeting protocol ${id} not found`);
      }
      
      // Berechtigungsprüfung
      // Nur der Ersteller oder ein Team-/Projektadmin darf ein Protokoll bearbeiten
      if (protocol.creatorId !== userId) {
        let hasAdminAccess = false;
        
        if (protocol.teamId) {
          // Team-Admin-Berechtigungen prüfen
          const [teamMember] = await db
            .select()
            .from(teamMembers)
            .where(and(
              eq(teamMembers.teamId, protocol.teamId),
              eq(teamMembers.userId, userId),
              eq(teamMembers.role, "admin")
            ));
          
          hasAdminAccess = !!teamMember;
        } else if (protocol.projectId) {
          // Projekt-Admin-Berechtigungen prüfen (Projektersteller)
          const [project] = await db
            .select()
            .from(projects)
            .where(and(
              eq(projects.id, protocol.projectId),
              eq(projects.creator_id, userId)
            ));
          
          hasAdminAccess = !!project;
        } else if (protocol.objectiveId) {
          // Objective-Admin-Berechtigungen prüfen (Objective-Ersteller)
          const [objective] = await db
            .select()
            .from(objectives)
            .where(and(
              eq(objectives.id, protocol.objectiveId),
              eq(objectives.creatorId, userId)
            ));
          
          hasAdminAccess = !!objective;
        }
        
        if (!hasAdminAccess) {
          throw new Error(`Unauthorized to update meeting protocol ${id}`);
        }
      }
      
      // Protokoll aktualisieren
      const [updatedProtocol] = await db
        .update(meetingProtocols)
        .set(updateData)
        .where(eq(meetingProtocols.id, id))
        .returning();
      
      // Aktualisiertes Protokoll mit Zusatzinformationen zurückgeben
      return this.getMeetingProtocol(userId, updatedProtocol.id);
    } catch (error) {
      console.error("Error in updateMeetingProtocol:", error);
      throw error;
    }
  }

  async deleteMeetingProtocol(userId: number, id: number): Promise<void> {
    try {
      console.log(`Deleting meeting protocol ${id} for user ${userId}`);
      
      // Vorhandenes Protokoll abrufen und Berechtigung prüfen
      const [protocol] = await db.select().from(meetingProtocols).where(eq(meetingProtocols.id, id));
      
      if (!protocol) {
        throw new Error(`Meeting protocol ${id} not found`);
      }
      
      // Berechtigungsprüfung (ähnlich wie bei updateMeetingProtocol)
      // Nur der Ersteller oder ein Team-/Projektadmin darf ein Protokoll löschen
      if (protocol.creatorId !== userId) {
        let hasAdminAccess = false;
        
        if (protocol.teamId) {
          // Team-Admin-Berechtigungen prüfen
          const [teamMember] = await db
            .select()
            .from(teamMembers)
            .where(and(
              eq(teamMembers.teamId, protocol.teamId),
              eq(teamMembers.userId, userId),
              eq(teamMembers.role, "admin")
            ));
          
          hasAdminAccess = !!teamMember;
        } else if (protocol.projectId) {
          // Projekt-Admin-Berechtigungen prüfen (Projektersteller)
          const [project] = await db
            .select()
            .from(projects)
            .where(and(
              eq(projects.id, protocol.projectId),
              eq(projects.creator_id, userId)
            ));
          
          hasAdminAccess = !!project;
        } else if (protocol.objectiveId) {
          // Objective-Admin-Berechtigungen prüfen (Objective-Ersteller)
          const [objective] = await db
            .select()
            .from(objectives)
            .where(and(
              eq(objectives.id, protocol.objectiveId),
              eq(objectives.creatorId, userId)
            ));
          
          hasAdminAccess = !!objective;
        }
        
        if (!hasAdminAccess) {
          throw new Error(`Unauthorized to delete meeting protocol ${id}`);
        }
      }
      
      // Protokoll löschen
      await db
        .delete(meetingProtocols)
        .where(eq(meetingProtocols.id, id));
    } catch (error) {
      console.error("Error in deleteMeetingProtocol:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();