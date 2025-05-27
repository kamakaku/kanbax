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
  // Prüft, ob ein Benutzer ein Hyper-Admin ist
  async isHyperAdmin(userId: number): Promise<boolean> {
    if (!userId) return false;
    
    console.log(`Checking if user ${userId} is a Hyper-Admin`);
    
    const userQuery = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    // Im Produktivbetrieb sollte isHyperAdmin explizit true sein
    // Wir setzen nicht einfach auf true für alle Benutzer
    const isAdmin = userQuery?.isHyperAdmin === true;
    console.log(`User ${userId} is Hyper-Admin: ${isAdmin}`);
    return isAdmin;
  }
  
  // Zugriffsprüfung für Unternehmen
  async canAccessCompany(userId: number, companyId: number): Promise<boolean> {
    console.log(`Checking company access for user ${userId} on company ${companyId}`);

    // Hyper-Admin hat immer Zugriff auf alle Unternehmen
    const isHyperAdmin = await this.isHyperAdmin(userId);
    if (isHyperAdmin) {
      console.log(`Access GRANTED: User ${userId} is a Hyper-Admin`);
      return true;
    }

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
    
    // Hyper-Admin hat immer Zugriff auf alle Teams
    const isHyperAdmin = await this.isHyperAdmin(userId);
    if (isHyperAdmin) {
      console.log(`Access GRANTED: User ${userId} is a Hyper-Admin`);
      return true;
    }

    // Hole das Team und prüfe Unternehmenszugehörigkeit
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    if (!team) return false;
    
    // 1. Ersteller hat immer Zugriff, unabhängig von allen anderen Berechtigungen
    if (team.creatorId === userId) {
      console.log(`Access GRANTED: User ${userId} is creator of team ${teamId}`);
      return true;
    }

    // 2. Prüfe, ob der Benutzer Mitglied des Teams ist
    const [teamMember] = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      ));

    if (teamMember) {
      console.log(`Access GRANTED: User ${userId} is a member of team ${teamId}`);
      return true;
    }

    // Hinweis: Unternehmens-Admins haben nicht automatisch Zugriff auf alle Teams
    // Die Berechtigung muss explizit über Zuweisung oder Teammitgliedschaft erteilt werden

    console.log(`Access DENIED: User ${userId} has no permissions for team ${teamId}`);
    return false;
  }

  // Zugriffsprüfung für Projekte unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessProject(userId: number, projectId: number): Promise<boolean> {
    console.log(`Checking project access for user ${userId} on project ${projectId}`);
    
    // Hyper-Admin hat immer Zugriff auf alle Projekte
    const isHyperAdmin = await this.isHyperAdmin(userId);
    if (isHyperAdmin) {
      console.log(`Access GRANTED: User ${userId} is a Hyper-Admin`);
      return true;
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) return false;
    
    // 1. Ersteller hat immer Zugriff, unabhängig von allen anderen Berechtigungen
    if (project.creator_id === userId) {
      console.log(`Access GRANTED: User ${userId} is creator of project ${projectId}`);
      return true;
    }
    
    // 2. Direkt zugewiesene Mitglieder haben Zugriff
    if (project.memberIds && project.memberIds.includes(userId)) {
      console.log(`Access GRANTED: User ${userId} is directly assigned to project ${projectId}`);
      return true;
    }

    // 3. Prüfe Team-Mitgliedschaft
    const userTeams = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const userTeamIds = userTeams.map(tm => tm.teamId);

    if (project.teamIds && project.teamIds.some(teamId => userTeamIds.includes(teamId))) {
      console.log(`Access GRANTED: User ${userId} is member of a team assigned to project ${projectId}`);
      return true;
    }

    // Hinweis: Unternehmens-Admins haben nicht automatisch Zugriff auf alle Projekte
    // Die Berechtigung muss explizit über Zuweisung oder Teammitgliedschaft erteilt werden
    
    console.log(`Access DENIED: User ${userId} has no permissions for project ${projectId}`);
    return false;
  }

  // Zugriffsprüfung für Boards unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessBoard(userId: number, boardId: number): Promise<boolean> {
    console.log(`Checking board access for user ${userId} on board ${boardId}`);
    
    // Hyper-Admin hat immer Zugriff auf alle Boards
    const isHyperAdmin = await this.isHyperAdmin(userId);
    if (isHyperAdmin) {
      console.log(`Access GRANTED: User ${userId} is a Hyper-Admin`);
      return true;
    }

    const [board] = await db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId));

    if (!board) return false;

    // 1. Ersteller hat immer Zugriff, unabhängig von allen anderen Berechtigungen
    if (board.creator_id === userId) {
      console.log(`Access GRANTED: User ${userId} is creator of board ${boardId}`);
      return true;
    }

    // 2. Prüfe direkte Benutzerzuweisung
    if (board.assigned_user_ids && board.assigned_user_ids.includes(userId)) {
      console.log(`Access GRANTED: User ${userId} is directly assigned to board ${boardId}`);
      return true;
    }

    // 3. Prüfe Board-Mitgliedsrolle
    const [boardMember] = await db
      .select()
      .from(boardMembers)
      .where(and(
        eq(boardMembers.boardId, boardId),
        eq(boardMembers.userId, userId)
      ));

    if (boardMember) {
      console.log(`Access GRANTED: User ${userId} is a board member of board ${boardId}`);
      return true;
    }

    // 4. Prüfe Team-Mitgliedschaft
    // Hole alle Teams des Benutzers
    const userTeams = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const userTeamIds = userTeams.map(tm => tm.teamId);

    // Prüfe, ob eines der Teams des Benutzers dem Board zugewiesen ist
    if (board.team_ids && board.team_ids.some(teamId => userTeamIds.includes(teamId))) {
      console.log(`Access GRANTED: User ${userId} is member of a team assigned to board ${boardId}`);
      return true;
    }

    // 5. Prüfe Projekt-Zugehörigkeit 
    if (board.project_id) {
      const hasProjectAccess = await this.canAccessProject(userId, board.project_id);
      if (hasProjectAccess) {
        console.log(`Access GRANTED: User ${userId} has access to project of board ${boardId}`);
        return true;
      }
    }

    console.log(`Access DENIED: User ${userId} has no permissions for board ${boardId}`);
    return false;
  }

  // Zugriffsprüfung für Objectives unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessObjective(userId: number, objectiveId: number): Promise<boolean> {
    console.log(`Checking objective access for user ${userId} on objective ${objectiveId}`);
    
    // Hyper-Admin hat immer Zugriff auf alle Objectives
    const isHyperAdmin = await this.isHyperAdmin(userId);
    if (isHyperAdmin) {
      console.log(`Access GRANTED: User ${userId} is a Hyper-Admin`);
      return true;
    }

    const [objective] = await db
      .select()
      .from(objectives)
      .where(eq(objectives.id, objectiveId));

    if (!objective) return false;

    // 1. Ersteller hat immer Zugriff, unabhängig von allen anderen Berechtigungen
    if (objective.creatorId === userId) {
      console.log(`Access GRANTED: User ${userId} is creator of objective ${objectiveId}`);
      return true;
    }

    // 2. Prüfe direkte Benutzerzuweisung
    if (objective.userIds && objective.userIds.includes(userId)) {
      console.log(`Access GRANTED: User ${userId} is directly assigned to objective ${objectiveId}`);
      return true;
    }

    // 3. Prüfe Objective-Mitgliedsrolle
    const [objectiveMember] = await db
      .select()
      .from(objectiveMembers)
      .where(and(
        eq(objectiveMembers.objectiveId, objectiveId),
        eq(objectiveMembers.userId, userId)
      ));

    if (objectiveMember) {
      console.log(`Access GRANTED: User ${userId} is a member of objective ${objectiveId}`);
      return true;
    }

    // 4. Prüfe Team-Mitgliedschaft wenn Objective ein Team hat
    if (objective.teamId) {
      const hasTeamAccess = await this.canAccessTeam(userId, objective.teamId);
      if (hasTeamAccess) {
        console.log(`Access GRANTED: User ${userId} is member of team assigned to objective ${objectiveId}`);
        return true;
      }
    }

    // 5. Prüfe Projekt-Zugehörigkeit
    if (objective.projectId) {
      const hasProjectAccess = await this.canAccessProject(userId, objective.projectId);
      if (hasProjectAccess) {
        console.log(`Access GRANTED: User ${userId} has access to project of objective ${objectiveId}`);
        return true;
      }
    }

    console.log(`Access DENIED: User ${userId} has no permissions for objective ${objectiveId}`);
    return false;
  }

  // Zugriffsprüfung für Benutzer unter Berücksichtigung der Unternehmenszugehörigkeit
  async canAccessUser(userId: number, targetUserId: number): Promise<boolean> {
    // Ein Benutzer kann seine eigenen Daten immer sehen
    if (userId === targetUserId) return true;
    
    // Hyper-Admin hat immer Zugriff auf alle Benutzer
    const isHyperAdmin = await this.isHyperAdmin(userId);
    if (isHyperAdmin) {
      console.log(`Access GRANTED: User ${userId} is a Hyper-Admin`);
      return true;
    }

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
    // Hyper-Admin kann alle Benutzer sehen
    const isHyperAdmin = await this.isHyperAdmin(userId);
    if (isHyperAdmin) {
      console.log(`User ${userId} is a Hyper-Admin and can see all users`);
      return users;
    }
    
    // Benutzer können sich selbst und alle Benutzer in ihrem Unternehmen sehen
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
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
    // Hyper-Admin kann alle Team-Mitglieder sehen
    const isHyperAdmin = await this.isHyperAdmin(userId);
    if (isHyperAdmin) {
      console.log(`User ${userId} is a Hyper-Admin and can see all team members`);
      return teamMembers;
    }
    
    // Hole die Unternehmenszugehörigkeit des aktuellen Benutzers
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    if (!currentUser || !currentUser.companyId) {
      // Wenn kein Unternehmen zugeordnet ist, Zugriff nur auf eigene Team-Mitgliedschaften
      return teamMembers.filter(tm => tm.userId === userId);
    }
    
    // Hole alle Teams des Unternehmens
    const companyTeams = await db.query.teams.findMany({
      where: eq(teams.companyId, currentUser.companyId)
    });
      
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
      console.log(`Getting visible activity logs for user ${userId}`);
      
      // Prüfe, ob der Benutzer ein Hyper-Admin ist
      const isHyperAdmin = await this.isHyperAdmin(userId);
      
      if (isHyperAdmin) {
        // Hyper-Admin sieht alle Aktivitäten im System
        console.log(`User ${userId} is a Hyper-Admin and can see all activity logs`);
        
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
          ORDER BY a.created_at DESC
          LIMIT 200
        `);
        
        return result.rows;
      }
      
      // Normale Benutzer sehen nur relevante Aktivitäten
      // 1. Hole die Unternehmenszugehörigkeit des Benutzers
      const userResult = await pool.query(`
        SELECT company_id FROM users WHERE id = $1
      `, [userId]);
      
      if (userResult.rows.length === 0) {
        console.log(`User ${userId} not found, returning empty activity list`);
        return [];
      }
      
      const companyId = userResult.rows[0].company_id;
      console.log(`User ${userId} belongs to company ${companyId}`);
      
      // Hole die Boards, auf die der Benutzer Zugriff hat - verbesserte Abfrage
      const accessibleBoardsQuery = await pool.query(`
        SELECT DISTINCT b.id 
        FROM boards b
        LEFT JOIN board_members bm ON b.id = bm.board_id
        LEFT JOIN teams t ON (b.team_ids IS NOT NULL AND b.team_ids && ARRAY[t.id])
        LEFT JOIN team_members tm ON t.id = tm.team_id
        LEFT JOIN tasks task ON task.board_id = b.id
        WHERE 
          -- Der Benutzer ist Ersteller des Boards
          b.creator_id = $1 OR 
          -- Der Benutzer ist Board-Mitglied
          bm.user_id = $1 OR 
          -- Der Benutzer ist in einem Team, das dem Board zugeordnet ist
          tm.user_id = $1 OR
          -- Der Benutzer ist dem Board direkt zugewiesen
          (b.assigned_user_ids IS NOT NULL AND $1 = ANY(b.assigned_user_ids)) OR
          -- Der Benutzer ist einer Task in diesem Board zugewiesen
          (task.assigned_user_ids IS NOT NULL AND $1 = ANY(task.assigned_user_ids))
      `, [userId]);
      
      const accessibleBoardIds = accessibleBoardsQuery.rows.map(row => row.id);
      console.log(`User ${userId} has access to ${accessibleBoardIds.length} boards`);
      
      // Hole die Projekte, auf die der Benutzer Zugriff hat - verbesserte Abfrage
      const accessibleProjectsQuery = await pool.query(`
        SELECT DISTINCT p.id 
        FROM projects p
        LEFT JOIN project_teams pt ON p.id = pt.project_id
        LEFT JOIN team_members tm ON pt.team_id = tm.team_id
        -- Zusätzlich Boards einbeziehen, die zu diesem Projekt gehören
        LEFT JOIN boards b ON b.project_id = p.id
        LEFT JOIN board_members bm ON b.id = bm.board_id
        -- Zusätzlich Tasks einbeziehen, die zu einem Board dieses Projekts gehören
        LEFT JOIN tasks t ON t.board_id = b.id
        WHERE 
          -- Der Benutzer ist Projektersteller
          p.creator_id = $1 OR 
          -- Der Benutzer ist Mitglied eines Teams, das dem Projekt zugewiesen ist
          tm.user_id = $1 OR
          -- Der Benutzer ist Ersteller eines Boards in diesem Projekt
          b.creator_id = $1 OR
          -- Der Benutzer ist Mitglied eines Boards in diesem Projekt
          bm.user_id = $1 OR
          -- Der Benutzer ist einem Board direkt zugewiesen, das zu diesem Projekt gehört
          (b.assigned_user_ids IS NOT NULL AND $1 = ANY(b.assigned_user_ids)) OR
          -- Der Benutzer ist einer Task in diesem Projekt zugewiesen
          (t.assigned_user_ids IS NOT NULL AND $1 = ANY(t.assigned_user_ids))
      `, [userId]);
      
      const accessibleProjectIds = accessibleProjectsQuery.rows.map(row => row.id);
      console.log(`User ${userId} has access to ${accessibleProjectIds.length} projects`);
      
      // Hole die Teams, in denen der Benutzer Mitglied ist
      const accessibleTeamsQuery = await pool.query(`
        SELECT DISTINCT t.id 
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        WHERE 
          t.creator_id = $1 OR 
          tm.user_id = $1
      `, [userId]);
      
      const accessibleTeamIds = accessibleTeamsQuery.rows.map(row => row.id);
      console.log(`User ${userId} is a member of ${accessibleTeamIds.length} teams`);
      
      // Hole die Objectives, auf die der Benutzer Zugriff hat - verbesserte Abfrage
      const accessibleObjectivesQuery = await pool.query(`
        SELECT DISTINCT o.id 
        FROM objectives o
        LEFT JOIN objective_members om ON o.id = om.objective_id
        LEFT JOIN teams t ON o.team_id = t.id
        LEFT JOIN team_members tm ON t.id = tm.team_id
        -- Zusätzlich Key Results einbeziehen, die zu diesem Objective gehören
        LEFT JOIN key_results kr ON kr.objective_id = o.id
        WHERE 
          -- Der Benutzer ist Objective-Ersteller
          o.creator_id = $1 OR 
          -- Der Benutzer ist direkt dem Objective zugewiesen
          om.user_id = $1 OR 
          -- Der Benutzer ist Mitglied eines Teams, das dem Objective zugewiesen ist
          tm.user_id = $1 OR
          -- Der Benutzer ist Ersteller eines Key Results in diesem Objective
          kr.creator_id = $1 OR
          -- Der Benutzer kann das Objective sehen, weil er in der visibleToUserIds-Liste steht
          (o.visible_to_user_ids IS NOT NULL AND $1 = ANY(o.visible_to_user_ids))
      `, [userId]);
      
      const accessibleObjectiveIds = accessibleObjectivesQuery.rows.map(row => row.id);
      console.log(`User ${userId} has access to ${accessibleObjectiveIds.length} objectives`);
      
      // Hole die Tasks, auf die der Benutzer Zugriff hat - verbesserte Abfrage
      const accessibleTasksQuery = await pool.query(`
        SELECT DISTINCT t.id 
        FROM tasks t
        LEFT JOIN boards b ON t.board_id = b.id
        LEFT JOIN board_members bm ON b.id = bm.board_id
        LEFT JOIN teams tm ON (
          -- Wenn das Board Teams hat
          (b.team_ids IS NOT NULL AND b.team_ids && ARRAY[tm.id]) OR
          -- ODER wenn die Task direkt einem Team zugewiesen ist
          t.assigned_team_id = tm.id
        )
        LEFT JOIN team_members tm_members ON tm.id = tm_members.team_id
        WHERE 
          -- Direkter Zugriff über Task-Eigenschaften (Tasks haben keine creator_id Spalte)
          (t.assigned_user_ids IS NOT NULL AND $1 = ANY(t.assigned_user_ids)) OR
          -- Zugriff über Board-Mitgliedschaft
          bm.user_id = $1 OR 
          -- Zugriff über Team-Mitgliedschaft
          tm_members.user_id = $1 OR
          -- Zusätzlich: Der Benutzer hat Zugriff auf das Board
          (b.creator_id = $1) OR
          (b.assigned_user_ids IS NOT NULL AND $1 = ANY(b.assigned_user_ids))
      `, [userId]);
      
      const accessibleTaskIds = accessibleTasksQuery.rows.map(row => row.id);
      console.log(`User ${userId} has access to ${accessibleTaskIds.length} tasks`);
      
      // 2. Verwende eine sicherere, parametrisierte SQL-Abfrage
      const queryParts = [];
      const queryParams = [userId]; // Das erste Parameter ist immer die User ID
      let paramCounter = 2; // Starte bei 2, da userId schon bei $1 ist
      
      // Benutzer ist direkt beteiligt
      queryParts.push(`a.user_id = $1 OR a.target_user_id = $1`);
      
      // Baut dynamisch die WHERE-Bedingungen basierend auf den verfügbaren IDs auf
      if (accessibleBoardIds.length > 0) {
        const placeholders = accessibleBoardIds.map((_, idx) => `$${paramCounter + idx}`).join(',');
        queryParts.push(`(a.board_id IS NOT NULL AND a.board_id IN (${placeholders}))`);
        queryParams.push(...accessibleBoardIds);
        paramCounter += accessibleBoardIds.length;
      }
      
      if (accessibleProjectIds.length > 0) {
        const placeholders = accessibleProjectIds.map((_, idx) => `$${paramCounter + idx}`).join(',');
        queryParts.push(`(a.project_id IS NOT NULL AND a.project_id IN (${placeholders}))`);
        queryParams.push(...accessibleProjectIds);
        paramCounter += accessibleProjectIds.length;
      }
      
      if (accessibleObjectiveIds.length > 0) {
        const placeholders = accessibleObjectiveIds.map((_, idx) => `$${paramCounter + idx}`).join(',');
        queryParts.push(`(a.objective_id IS NOT NULL AND a.objective_id IN (${placeholders}))`);
        queryParams.push(...accessibleObjectiveIds);
        paramCounter += accessibleObjectiveIds.length;
      }
      
      if (accessibleTeamIds.length > 0) {
        const placeholders = accessibleTeamIds.map((_, idx) => `$${paramCounter + idx}`).join(',');
        queryParts.push(`(a.team_id IS NOT NULL AND a.team_id IN (${placeholders}))`);
        queryParams.push(...accessibleTeamIds);
        paramCounter += accessibleTeamIds.length;
      }
      
      if (accessibleTaskIds.length > 0) {
        const placeholders = accessibleTaskIds.map((_, idx) => `$${paramCounter + idx}`).join(',');
        queryParts.push(`(a.task_id IS NOT NULL AND a.task_id IN (${placeholders}))`);
        queryParams.push(...accessibleTaskIds);
        paramCounter += accessibleTaskIds.length;
      }
      
      // Füge den firmenId Parameter hinzu
      queryParams.push(companyId);
      const companyIdParamIndex = paramCounter;
      
      // Erstelle die vollständige WHERE-Klausel
      const whereClause = `(${queryParts.join(' OR ')})`;
      
      // Baue die vollständige Abfrage - aber vermeidet String-Interpolation in kritischen Teilen
      const query = `
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
        WHERE ` + whereClause + `
        AND (
          -- Wenn der aktuelle Benutzer keiner Firma zugeordnet ist, dann alle Aktivitäten anzeigen
          $` + companyIdParamIndex + ` IS NULL
          OR 
          -- Sonst nur Aktivitäten aus der gleichen Firma
          EXISTS (
            SELECT 1 FROM users WHERE id = a.user_id AND company_id = $` + companyIdParamIndex + `
          )
        )
        ORDER BY a.created_at DESC
        LIMIT 100
      `;
      
      console.log(`Executing activity logs query with ${queryParams.length} parameters`);
      const result = await pool.query(query, queryParams);

      console.log(`Found ${result.rows.length} relevant activity logs for user ${userId}`);
      return result.rows;
    } catch (error) {
      console.error("Error getting visible activity logs:", error);
      return [];
    }
  }
}

export const permissionService = new PermissionService();