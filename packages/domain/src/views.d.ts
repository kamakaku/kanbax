import { TaskStatus, TaskPriority, TaskSource } from './task';
import { AuditAction } from './audit';
import { PrincipalType } from './identity';
export interface TaskView {
    id: string;
    tenantId: string;
    ownerId?: string | null;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignees: string[];
    labels: string[];
    sourceType: TaskSource['type'];
    sourceIndicator: string;
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
//# sourceMappingURL=views.d.ts.map
