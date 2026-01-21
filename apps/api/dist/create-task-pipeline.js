import { AuditAction, TaskPriority, TaskStatus } from '@kanbax/domain';
import { CommandPipeline } from './command-pipeline.js';
export class CreateTaskPipeline extends CommandPipeline {
    validate(command) {
        if (!command.payload.title)
            throw new Error('Title is required');
        if (!command.payload.boardId)
            throw new Error('Board ID is required');
        if (!command.payload.source)
            throw new Error('Source is required');
    }
    async loadPolicyContext(command) {
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
    async handle(command, context) {
        const task = {
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
                },
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
    getResourceId(command) {
        return 'new-task';
    }
    getResourceType() {
        return 'TASK';
    }
    getAuditAction() {
        return AuditAction.TASK_CREATE;
    }
    getRequiredPermissions() {
        return ['task.create'];
    }
}
//# sourceMappingURL=create-task-pipeline.js.map