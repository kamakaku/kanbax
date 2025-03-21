import { db } from "./db";
import { storage } from "./storage";
import { eq, inArray, and, or, desc } from "drizzle-orm";
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
  tasks
} from "@shared/schema";

export class PermissionService {
  // Zugriffsprüfungen für verschiedene Entitäten
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

    return board.team_ids.some(teamId => userTeamIds.includes(teamId));
  }

  async canAccessProject(userId: number, projectId: number): Promise<boolean> {
    console.log(`Checking project access for user ${userId} on project ${projectId}`);

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) return false;

    // Prüfe Team-Mitgliedschaft
    const userTeams = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const userTeamIds = userTeams.map(tm => tm.teamId);

    return project.teamIds?.some(teamId => userTeamIds.includes(teamId)) ?? false;
  }

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
      const [teamMember] = await db
        .select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, objective.teamId),
          eq(teamMembers.userId, userId)
        ));

      if (teamMember) return true;
    }

    return false;
  }

  async canAccessUser(userId: number, targetUserId: number): Promise<boolean> {
    // Ein Benutzer kann nur seine eigenen Daten sehen
    return userId === targetUserId;
  }

  async canAccessTeam(userId: number, teamId: number): Promise<boolean> {
    const [teamMember] = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ));

    return !!teamMember;
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
    return users.filter(user => user.id === userId);
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
    const userTeams = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const userTeamIds = new Set(userTeams.map(tm => tm.teamId));
    return teamMembers.filter(tm => userTeamIds.has(tm.teamId));
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

  // Activity Log Filterung
  async getVisibleActivityLogs(userId: number): Promise<ActivityLog[]> {
    const userTeams = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const userTeamIds = userTeams.map(tm => tm.teamId);

    return await db
      .select({
        ...activityLogs,
        board_title: boards.title,
        project_title: projects.title,
        objective_title: objectives.title,
        user_name: users.username,
        avatar_url: users.avatarUrl
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .leftJoin(boards, eq(activityLogs.boardId, boards.id))
      .leftJoin(projects, eq(activityLogs.projectId, projects.id))
      .leftJoin(objectives, eq(activityLogs.objectiveId, objectives.id))
      .where(
        or(
          // Benutzer ist Ersteller oder direkt sichtbar
          eq(activityLogs.userId, userId),
          inArray(activityLogs.visibleToUsers, [userId]),
          // Benutzer-Teams haben Zugriff
          inArray(activityLogs.visibleToTeams, userTeamIds),
          // Benutzer hat Zugriff auf das referenzierte Board
          and(
            eq(boards.creator_id, userId),
            eq(activityLogs.boardId, boards.id)
          ),
          // Benutzer hat Zugriff auf das referenzierte Projekt
          and(
            inArray(projects.teamIds, userTeamIds),
            eq(activityLogs.projectId, projects.id)
          ),
          // Benutzer hat Zugriff auf das referenzierte Objective
          and(
            eq(objectives.creatorId, userId),
            eq(activityLogs.objectiveId, objectives.id)
          )
        )
      )
      .orderBy(desc(activityLogs.createdAt))
      .limit(30);
  }
}

export const permissionService = new PermissionService();