import { db, pool } from "./db";
import { eq, inArray, and, or, desc, sql, isNotNull, exists } from "drizzle-orm";
import {
  boards,
  boardMembers,
  projects,
  projectTeams,
  objectives,
  objectiveMembers,
  teams,
  teamMembers,
  users,
  activityLogs,
  companies,
  type User,
  type Board,
  type Project,
  type Team,
  type TeamMember,
  type Column,
  type Comment,
  type ChecklistItem,
  type ActivityLog,
  type Objective,
  type Company,
  tasks
} from "@shared/schema";

export class PermissionService {
  // Zugriffsprüfung für Unternehmen
  async canAccessCompany(userId: number, companyId: number): Promise<boolean> {
    console.log(`Checking company access for user ${userId} on company ${companyId}`);

    // Prüfe, ob der Benutzer Teil des Unternehmens ist
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.companyId, companyId)
      ));

    return !!user;
  }

  // Zugriffsprüfung für Teams unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessTeam(userId: number, teamId: number): Promise<boolean> {
    console.log(`Checking team access for user ${userId} on team ${teamId}`);

    // Hole das Team und prüfe Unternehmenszugehörigkeit
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    if (!team) return false;
    
    // Ersteller hat immer Zugriff
    if (team.creatorId === userId) return true;

    // Prüfe, ob der Benutzer Zugriff auf das Unternehmen hat
    const hasCompanyAccess = await this.canAccessCompany(userId, team.companyId);
    if (!hasCompanyAccess) return false;

    // Prüfe, ob der Benutzer Mitglied des Teams ist
    const [teamMember] = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ));

    return !!teamMember;
  }

  // Zugriffsprüfung für Projekte unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessProject(userId: number, projectId: number): Promise<boolean> {
    console.log(`Checking project access for user ${userId} on project ${projectId}`);

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) return false;
    
    // Ersteller hat immer Zugriff
    if (project.creator_id === userId) return true;
    
    // Direkt zugewiesene Mitglieder haben Zugriff
    if (project.memberIds?.includes(userId)) return true;

    // Prüfe, ob der Benutzer Zugriff auf das Unternehmen hat
    if (project.companyId) {
      const hasCompanyAccess = await this.canAccessCompany(userId, project.companyId);
      if (!hasCompanyAccess) return false;
    }

    // Prüfe Team-Mitgliedschaft
    const userTeams = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const userTeamIds = userTeams.map(tm => tm.teamId);

    return project.teamIds?.some(teamId => userTeamIds.includes(teamId)) ?? false;
  }

  // Zugriffsprüfung für Boards unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessBoard(userId: number, boardId: number): Promise<boolean> {
    console.log(`Checking board access for user ${userId} on board ${boardId}`);

    const [board] = await db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId));

    if (!board) return false;

    // Ersteller hat immer Zugriff
    if (board.creator_id === userId) return true;

    // Prüfe direkte Benutzerzuweisung
    if (board.assigned_user_ids.includes(userId)) return true;

    // Prüfe Board-Mitgliedsrolle
    const [boardMember] = await db
      .select()
      .from(boardMembers)
      .where(and(
        eq(boardMembers.boardId, boardId),
        eq(boardMembers.userId, userId)
      ));

    if (boardMember) return true;

    // Prüfe Team-Mitgliedschaft
    const userTeams = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const userTeamIds = userTeams.map(tm => tm.teamId);

    // Prüfe Projekt-Zugehörigkeit und Unternehmenszugehörigkeit
    if (board.project_id) {
      const hasProjectAccess = await this.canAccessProject(userId, board.project_id);
      if (hasProjectAccess) return true;
    }

    return board.team_ids.some(teamId => userTeamIds.includes(teamId));
  }

  // Zugriffsprüfung für Objectives unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessObjective(userId: number, objectiveId: number): Promise<boolean> {
    console.log(`Checking objective access for user ${userId} on objective ${objectiveId}`);

    const [objective] = await db
      .select()
      .from(objectives)
      .where(eq(objectives.id, objectiveId));

    if (!objective) return false;

    // Ersteller hat immer Zugriff
    if (objective.creatorId === userId) return true;

    // Prüfe direkte Benutzerzuweisung
    if (objective.userIds?.includes(userId)) return true;

    // Prüfe Objective-Mitgliedsrolle
    const [objectiveMember] = await db
      .select()
      .from(objectiveMembers)
      .where(and(
        eq(objectiveMembers.objectiveId, objectiveId),
        eq(objectiveMembers.userId, userId)
      ));

    if (objectiveMember) return true;

    // Prüfe Team-Mitgliedschaft wenn Objective ein Team hat
    if (objective.teamId) {
      const hasTeamAccess = await this.canAccessTeam(userId, objective.teamId);
      if (hasTeamAccess) return true;
    }

    // Prüfe Projekt-Zugehörigkeit
    if (objective.projectId) {
      const hasProjectAccess = await this.canAccessProject(userId, objective.projectId);
      if (hasProjectAccess) return true;
    }

    return false;
  }

  // Zugriffsprüfung für Benutzer unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessUser(userId: number, targetUserId: number): Promise<boolean> {
    // Ein Benutzer kann seine eigenen Daten immer sehen
    if (userId === targetUserId) return true;

    // Prüfe, ob beide Benutzer zum selben Unternehmen gehören
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user || !user.companyId) return false;

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId));

    if (!targetUser || !targetUser.companyId) return false;

    // Wenn beide zum selben Unternehmen gehören, kann der Benutzer den Zielbenutzer sehen
    return user.companyId === targetUser.companyId;
  }

  // Filterfunktionen für verschiedene Entitäten
  async filterBoards(userId: number, boards: Board[]): Promise<Board[]> {
    const accessibleBoards = await Promise.all(
      boards.map(async (board) => {
        const hasAccess = await this.canAccessBoard(userId, board.id);
        return hasAccess ? board : null;
      })
    );
    return accessibleBoards.filter((board): board is Board => board !== null);
  }

  async filterProjects(userId: number, projects: Project[]): Promise<Project[]> {
    const accessibleProjects = await Promise.all(
      projects.map(async (project) => {
        const hasAccess = await this.canAccessProject(userId, project.id);
        return hasAccess ? project : null;
      })
    );
    return accessibleProjects.filter((project): project is Project => project !== null);
  }

  async filterUsers(userId: number, users: User[]): Promise<User[]> {
    // Benutzer können sich selbst und alle Benutzer in ihrem Unternehmen sehen
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!currentUser || !currentUser.companyId) {
      // Wenn der Benutzer kein Unternehmen hat, kann er nur sich selbst sehen
      return users.filter(user => user.id === userId);
    }

    // Der Benutzer kann alle Mitglieder seines Unternehmens sehen
    return users.filter(user => 
      user.id === userId || user.companyId === currentUser.companyId
    );
  }

  async filterTeams(userId: number, teams: Team[]): Promise<Team[]> {
    const accessibleTeams = await Promise.all(
      teams.map(async (team) => {
        const hasAccess = await this.canAccessTeam(userId, team.id);
        return hasAccess ? team : null;
      })
    );
    return accessibleTeams.filter((team): team is Team => team !== null);
  }

  async filterTeamMembers(userId: number, teamMembers: TeamMember[]): Promise<TeamMember[]> {
    // Hole die Unternehmenszugehörigkeit des aktuellen Benutzers
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!currentUser || !currentUser.companyId) {
      // Wenn kein Unternehmen zugeordnet ist, Zugriff nur auf eigene Team-Mitgliedschaften
      return teamMembers.filter(tm => tm.userId === userId);
    }
    
    // Hole alle Teams des Unternehmens
    const companyTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.companyId, currentUser.companyId));
      
    const companyTeamIds = new Set(companyTeams.map(team => team.id));
    
    // Filtere Team-Mitglieder, die zu Teams des gleichen Unternehmens gehören
    return teamMembers.filter(tm => companyTeamIds.has(tm.teamId));
  }

  async filterColumns(userId: number, columns: Column[]): Promise<Column[]> {
    if (columns.length === 0) return [];
    const boardId = columns[0].boardId;
    const hasAccess = await this.canAccessBoard(userId, boardId);
    return hasAccess ? columns : [];
  }

  async filterComments(userId: number, comments: Comment[]): Promise<Comment[]> {
    // Kommentare sind sichtbar, wenn der Benutzer Zugriff auf das zugehörige Board hat
    const filteredComments = await Promise.all(
      comments.map(async (comment) => {
        const task = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, comment.taskId))
          .limit(1);

        if (!task[0]) return null;

        const hasAccess = await this.canAccessBoard(userId, task[0].boardId);
        return hasAccess ? comment : null;
      })
    );
    return filteredComments.filter((comment): comment is Comment => comment !== null);
  }

  async filterChecklistItems(userId: number, items: ChecklistItem[]): Promise<ChecklistItem[]> {
    // Checklist-Items sind sichtbar, wenn der Benutzer Zugriff auf das zugehörige Board hat
    const filteredItems = await Promise.all(
      items.map(async (item) => {
        const task = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, item.taskId))
          .limit(1);

        if (!task[0]) return null;

        const hasAccess = await this.canAccessBoard(userId, task[0].boardId);
        return hasAccess ? item : null;
      })
    );
    return filteredItems.filter((item): item is ChecklistItem => item !== null);
  }

  // Activity Log Filterung basierend auf Unternehmenszugehörigkeit und Relevanz
  async getVisibleActivityLogs(userId: number): Promise<ActivityLog[]> {
    try {
      // Verwende Raw SQL Query für eine optimierte Abfrage, die alle benötigten Daten in einer einzigen Query lädt
      const result = await pool.query(`
        SELECT a.*, 
               b.title as board_title, 
               p.title as project_title,
               o.title as objective_title,
               t.title as task_title,
               tm.name as team_title,
               u.username, 
               u.avatar_url,
               tu.username as target_username
        FROM activity_logs a
        LEFT JOIN boards b ON a.board_id = b.id
        LEFT JOIN projects p ON a.project_id = p.id
        LEFT JOIN objectives o ON a.objective_id = o.id
        LEFT JOIN tasks t ON a.task_id = t.id
        LEFT JOIN teams tm ON a.team_id = tm.id
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN users tu ON a.target_user_id = tu.id
        WHERE a.user_id = $1 OR a.target_user_id = $1
        ORDER BY a.created_at DESC
        LIMIT 50
      `, [userId]);

      return result.rows;
    } catch (error) {
      console.error("Error getting visible activity logs:", error);
      return [];
    }
    
    // Alte implementierung wurde durch die SQL-Implementierung oben ersetzt
    /*
    // Hier befand sich die alte Implementierung
    */
  }
}

export const permissionService = new PermissionService();