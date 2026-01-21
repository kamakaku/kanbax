import {
    AuditAction,
    PolicyContext,
    Task,
    TaskId,
    TaskPriority,
    TaskStatus,
    TaskSource,
    TaskActivity,
    TaskAttachment,
    TaskChecklistItem,
    TaskComment,
    TenantId,
    UserId
} from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';

export interface CreateTaskCommand extends Command<{
    title: string;
    description?: string;
    kind?: string;
    kinds?: string[];
    boardId: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    ownerId?: UserId | null;
    assignees?: UserId[];
    attachments?: TaskAttachment[];
    comments?: TaskComment[];
    checklist?: TaskChecklistItem[];
    linkedTaskIds?: TaskId[];
    source: TaskSource;
    isFavorite?: boolean;
}> {
    type: 'TASK_CREATE';
}

export class CreateTaskPipeline extends CommandPipeline<CreateTaskCommand, Task> {
    protected validate(command: CreateTaskCommand): void {
        if (!command.payload.title) throw new Error('Title is required');
        if (!command.payload.boardId) throw new Error('Board ID is required');
        if (!command.payload.source) throw new Error('Source is required');
    }

    protected async loadPolicyContext(command: CreateTaskCommand): Promise<PolicyContext> {
        // In a real app, this would be fetched from a database
        return {
            tenantId: command.tenantId,
            scope: 'BOARD',
            scopeId: command.payload.boardId,
            rules: [
                { id: 'rule-1', action: 'TASK_CREATE', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' },
                { id: 'rule-2', action: 'TASK_UPDATE_STATUS', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' },
                { id: 'rule-3', action: 'TASK_UPDATE_DETAILS', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' },
                { id: 'rule-4', action: 'TASK_DELETE', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' }
            ],
            auditLevel: 'FULL',
        };
    }

    protected async handle(command: CreateTaskCommand, context: PolicyContext): Promise<Task> {
        const task: Task = {
            id: Math.random().toString(36).substring(2, 15),
            tenantId: command.tenantId,
            title: command.payload.title,
            description: command.payload.description,
            kinds: command.payload.kinds ?? (command.payload.kind ? [command.payload.kind] : []),
            status: command.payload.status ?? TaskStatus.BACKLOG,
            priority: command.payload.priority ?? TaskPriority.MEDIUM,
            dueDate: command.payload.dueDate ? new Date(command.payload.dueDate) : undefined,
            ownerId: command.payload.ownerId ?? command.principal.id,
            assignees: command.payload.assignees ?? [],
            labels: [],
            attachments: command.payload.attachments ?? [],
            comments: command.payload.comments ?? [],
            checklist: command.payload.checklist ?? [],
            linkedTaskIds: command.payload.linkedTaskIds ?? [],
            activityLog: [
                {
                    id: Math.random().toString(36).substring(2, 15),
                    type: 'CREATE',
                    message: 'Task created',
                    timestamp: new Date(),
                    actorId: command.principal.id,
                } as TaskActivity,
            ],
            isFavorite: command.payload.isFavorite ?? false,
            source: command.payload.source,
            policyContext: context,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
        };

        await this.repository.save(task);
        return task;
    }

    protected getResourceId(command: CreateTaskCommand): string {
        return 'new-task';
    }

    protected getResourceType(): 'TASK' {
        return 'TASK';
    }

    protected getAuditAction(): AuditAction {
        return AuditAction.TASK_CREATE;
    }

    protected getRequiredPermissions(): string[] {
        return ['task.create'];
    }
}
