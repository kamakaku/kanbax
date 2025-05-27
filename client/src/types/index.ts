// Typdefinitionen für die Frontend-Anwendung

// Benutzer
export interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  companyId: number | null;
  isCompanyAdmin: boolean | null;
  isActive: boolean | null;
  createdAt: Date;
}

// Projekt
export interface Project {
  id: number;
  title: string;
  description: string | null;
  createdAt: Date;
  teamIds: number[] | null;
  memberIds: number[] | null;
  archived: boolean | null;
  companyId: number | null;
  creator_id: number;
  isFavorite?: boolean | null;
}

// Board
export interface Board {
  id: number;
  title: string;
  description: string | null;
  team_ids: number[];
  is_favorite: boolean | null;
  archived: boolean | null;
  creator_id: number;
  richDescription: string | null;
  project_id: number | null;
  assigned_user_ids: number[];
  attachments: string[] | null;
  projectTitle?: string; // Für das Dashboard
}

// Spalte
export interface Column {
  id: number;
  title: string;
  order: number;
  boardId: number;
}

// Task
export interface Task {
  id: number;
  title: string;
  description: string | null;
  richDescription: string | null;
  status: string; // Status kann "backlog" | "todo" | "in-progress" | "review" | "done" sein
  priority: string; // Priorität kann "low" | "medium" | "high" sein
  labels: string[] | null;
  checklist: string[] | null;
  columnId: number | null;
  boardId: number | null;
  dueDate: string | null;
  startDate?: string | null; // Optional für Startdatum
  order: number;
  assignedUserIds: number[];
  assignedTeamId: number | null;
  assignedAt: string | null; // Hinzugefügt für Typ-Kompatibilität
  archived: boolean | null;
  attachments: string[] | null;
  createdAt?: string; // Optional für Erstellungsdatum
  creator_id?: number; // Optional für Ersteller ID
  board?: {
    id: number;
    title: string;
    projectId?: number | null;
  } | null;
  column?: {
    id: number;
    title: string;
  } | null;
  project?: {
    id: number;
    title: string;
  } | null;
  assignedUser?: {
    id: number;
    username: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  isPersonal?: boolean;
}

// OKR-Zyklus
export interface OkrCycle {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  companyId: number | null;
}

// Objective
export interface Objective {
  id: number;
  title: string;
  description: string | null;
  progress: number;
  cycleId: number | null;
  creatorId: number;
  status: string;
  createdAt: string;
  dueDate: string | null;
  isFavorite: boolean | null;
  archived: boolean | null;
  responsibleUserIds: number[];
  teamIds: number[];
}

// Key Result
export interface KeyResult {
  id: number;
  title: string;
  description: string | null;
  currentValue: number;
  targetValue: number;
  startValue: number;
  format: string;
  progress: number;
  objectiveId: number;
  createdAt: string;
  updatedAt: string | null;
  responsibleUserIds: number[];
}

// Team
export interface Team {
  id: number;
  name: string;
  description: string | null;
  companyId: number;
  creatorId: number;
  createdAt: Date;
}

// Team-Mitglied
export interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  role: string;
  joinedAt: Date;
}

// Kommentar
export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  userId: number;
  taskId: number | null;
  objectiveId: number | null;
  keyResultId: number | null;
  parentId: number | null;
}

// Aktivitätslog
export interface ActivityLog {
  id: number;
  userId: number;
  action: string;
  details: string | null;
  boardId: number | null;
  projectId: number | null;
  objectiveId: number | null;
  taskId: number | null;
  teamId: number | null;
  targetUserId: number | null;
  commentId: number | null;
  keyResultId: number | null;
  requiresNotification: boolean;
  notificationSent: boolean;
  notificationType: string | null;
  visibleToUsers: number[];
  createdAt: string;
}

// Erweiterter Aktivitätslog mit zusätzlichen Informationen
export interface ExtendedActivityLog extends ActivityLog {
  username?: string;
  avatar_url?: string | null;
  board_title?: string;
  project_title?: string;
  objective_title?: string;
  task_title?: string;
  team_title?: string;
  company_id?: number;
}

// Benachrichtigung
export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

// Benutzereinstellungen
export interface UserSettings {
  userId: number;
  taskAssigned: boolean;
  taskDue: boolean;
  taskUpdates: boolean;
  taskComments: boolean;
  boardInvite: boolean;
  boardUpdates: boolean;
  teamInvite: boolean;
  teamUpdates: boolean;
  projectUpdate: boolean;
  okrProgress: boolean;
  okrComments: boolean;
  mentions: boolean;
}

// Unternehmen
export interface Company {
  id: number;
  name: string;
  description: string | null;
  inviteCode: string;
  createdAt: Date;
}

// Produktivitätsmetriken
export interface UserProductivityMetrics {
  id?: number;
  userId: number;
  date: string;
  tasksCompleted: number | null;
  tasksCreated: number | null;
  timeSpentMinutes: number | null;
  objectivesAchieved: number | null;
}

// Zeiterfassung
export interface TimeTracking {
  id?: number;
  userId: number;
  taskId: number;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  createdAt?: string;
}