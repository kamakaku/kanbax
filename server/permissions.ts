import { db } from "./db";
import { eq, and, or, inArray } from "drizzle-orm";
import { projects, boards, objectives, teams, teamMembers, type AccessRole } from "@shared/schema";

export interface AuthUser {
  id: number;
  email: string;
}

// Helper function to check if a user is a member of a team
async function isTeamMember(userId: number, teamId: number): Promise<boolean> {
  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.userId, userId),
      eq(teamMembers.teamId, teamId)
    ),
  });
  return !!member;
}

// Check project access
export async function hasProjectAccess(user: AuthUser, projectId: number): Promise<boolean> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) return false;

  // Creator always has access
  if (project.creatorId === user.id) return true;

  // Check direct member access
  if (project.memberIds?.includes(user.id)) return true;

  // Check guest access
  if (project.guestEmails?.includes(user.email)) return true;

  // Check team access
  if (project.teamIds?.length) {
    for (const teamId of project.teamIds) {
      if (await isTeamMember(user.id, teamId)) return true;
    }
  }

  return false;
}

// Check board access
export async function hasBoardAccess(user: AuthUser, boardId: number): Promise<boolean> {
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
  });

  if (!board) return false;

  // Creator always has access
  if (board.creatorId === user.id) return true;

  // Check direct member access
  if (board.memberIds?.includes(user.id)) return true;

  // Check guest access
  if (board.guestEmails?.includes(user.email)) return true;

  // Check team access
  if (board.teamIds?.length) {
    for (const teamId of board.teamIds) {
      if (await isTeamMember(user.id, teamId)) return true;
    }
  }

  // If board belongs to a project, check project access
  if (board.projectId) {
    return hasProjectAccess(user, board.projectId);
  }

  return false;
}

// Check objective access
export async function hasObjectiveAccess(user: AuthUser, objectiveId: number): Promise<boolean> {
  const objective = await db.query.objectives.findFirst({
    where: eq(objectives.id, objectiveId),
  });

  if (!objective) return false;

  // Creator always has access
  if (objective.creatorId === user.id) return true;

  // Check direct assignment
  if (objective.userId === user.id) return true;
  if (objective.userIds?.includes(user.id)) return true;

  // Check team access
  if (objective.teamId && await isTeamMember(user.id, objective.teamId)) {
    return true;
  }

  // If objective belongs to a project, check project access
  if (objective.projectId) {
    return hasProjectAccess(user, objective.projectId);
  }

  return false;
}

// Express middleware for checking permissions
export function requireAccess(
  type: 'project' | 'board' | 'objective',
  idParam: string = 'id'
) {
  return async (req: any, res: any, next: any) => {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ message: "Nicht authentifiziert" });
    }

    const id = parseInt(req.params[idParam]);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige ID" });
    }

    let hasAccess = false;
    switch (type) {
      case 'project':
        hasAccess = await hasProjectAccess(user, id);
        break;
      case 'board':
        hasAccess = await hasBoardAccess(user, id);
        break;
      case 'objective':
        hasAccess = await hasObjectiveAccess(user, id);
        break;
    }

    if (!hasAccess) {
      return res.status(403).json({ message: "Keine Berechtigung" });
    }

    next();
  };
}
