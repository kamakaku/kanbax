import { TaskStatus, TaskPriority, TaskSource, TaskAttachment, TaskComment, TaskChecklistItem, TaskActivity } from './task';
import { AuditAction } from './audit';
import { PrincipalType } from './identity';

export interface TaskView {
    id: string;
    tenantId: string;
    boardId: string;
    ownerId?: string | null;
    title: string;
    description?: string;
    kinds: string[];
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date;
    excludeFromAll?: boolean;
    assignees: string[];
    labels: string[];
    attachments: TaskAttachment[];
    comments: TaskComment[];
    checklist: TaskChecklistItem[];
    linkedTaskIds: string[];
    activityLog: TaskActivity[];
    isFavorite: boolean;
    sourceType: TaskSource['type'];
    sourceIndicator: string; // e.g. "JIRA-123" or "Email"
    createdAt: Date;
    updatedAt: Date;
}

export interface BoardView {
    id: string;
    name: string;
    columns: {
        status: TaskStatus;
        tasks: TaskView[];
    }[];
}

export interface AuditEventView {
    id: string;
    timestamp: Date;
    actorId: string;
    actorType: PrincipalType;
    action: AuditAction;
    resourceId: string;
    resourceType: string;
    outcome: 'ALLOW' | 'DENY';
}
