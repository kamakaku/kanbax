import {
    AuditAction,
    PolicyContext,
    Task,
    TaskId,
    TaskAttachment,
    TaskChecklistItem,
    TaskComment,
    TaskPriority,
    TenantId,
    UserId
} from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';

export interface UpdateTaskDetailsCommand extends Command<{
    taskId: TaskId;
    title: string;
    description?: string;
    kind?: string;
    kinds?: string[];
    priority?: TaskPriority;
    dueDate?: string | null;
    ownerId?: UserId | null;
    assignees?: UserId[];
    attachmentsToAdd?: TaskAttachment[];
    attachmentsToRemove?: string[];
    commentText?: string;
    checklist?: TaskChecklistItem[];
    linkedTaskIds?: TaskId[];
    isFavorite?: boolean;
    excludeFromAll?: boolean;
}> {
    type: 'TASK_UPDATE_DETAILS';
}

export class UpdateTaskDetailsPipeline extends CommandPipeline<UpdateTaskDetailsCommand, Task> {
    protected validate(command: UpdateTaskDetailsCommand): void {
        if (!command.payload.taskId) throw new Error('Task ID is required');
        if (!command.payload.title) throw new Error('Title is required');
    }

    protected async loadPolicyContext(command: UpdateTaskDetailsCommand): Promise<PolicyContext> {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task) throw new Error('Task not found or access denied');

        (command as UpdateTaskDetailsCommand & { resourceTask?: Task }).resourceTask = task;

        const hasUpdateRule = task.policyContext.rules.some((rule) => rule.action === 'TASK_UPDATE_DETAILS');

        if (!hasUpdateRule) {
            return {
                ...task.policyContext,
                rules: [
                    ...task.policyContext.rules,
                    {
                        id: 'rule-update-details-manual',
                        action: 'TASK_UPDATE_DETAILS',
                        effect: 'ALLOW',
                        condition: 'resource.source.type=MANUAL',
                    },
                ],
            };
        }

        return task.policyContext;
    }

    protected async handle(command: UpdateTaskDetailsCommand, _context: PolicyContext): Promise<Task> {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task) throw new Error('Task not found');

        if (task.source.type !== 'MANUAL') {
            throw new Error('Only manual tasks can be updated in the UI');
        }

        const existingAttachments = task.attachments ?? [];
        const removeSet = new Set(command.payload.attachmentsToRemove ?? []);
        const attachmentsToAdd = command.payload.attachmentsToAdd ?? [];
        const nextAttachments = existingAttachments
            .filter((attachment) => !removeSet.has(attachment.id))
            .concat(attachmentsToAdd);

        const dueDateValue = command.payload.dueDate === null
            ? undefined
            : (command.payload.dueDate ? new Date(command.payload.dueDate) : task.dueDate);

        const normalizedKinds = command.payload.kinds
            ?? (command.payload.kind ? [command.payload.kind] : undefined)
            ?? task.kinds;

        const nextComments = [...(task.comments ?? [])];
        if (command.payload.commentText && command.payload.commentText.trim().length > 0) {
            nextComments.push({
                id: Math.random().toString(36).substring(2, 15),
                text: command.payload.commentText.trim(),
                createdAt: new Date(),
                createdBy: command.principal.id,
            });
        }

        const nextChecklist = command.payload.checklist ?? task.checklist;
        const nextActivityLog = [...(task.activityLog ?? [])];
        const activityEntries = [] as {
            type: 'DETAILS' | 'COMMENT' | 'CHECKLIST' | 'ATTACHMENT' | 'LINK';
            message: string;
        }[];
        if (command.payload.commentText && command.payload.commentText.trim().length > 0) {
            activityEntries.push({ type: 'COMMENT', message: 'Comment added' });
        }
        if (command.payload.checklist) {
            activityEntries.push({ type: 'CHECKLIST', message: 'Checklist updated' });
        }
        if ((command.payload.attachmentsToAdd && command.payload.attachmentsToAdd.length > 0)
            || (command.payload.attachmentsToRemove && command.payload.attachmentsToRemove.length > 0)) {
            activityEntries.push({ type: 'ATTACHMENT', message: 'Attachments updated' });
        }
        if (command.payload.linkedTaskIds) {
            activityEntries.push({ type: 'LINK', message: 'Linked tasks updated' });
        }
        if (command.payload.ownerId !== undefined || command.payload.assignees !== undefined) {
            activityEntries.push({ type: 'DETAILS', message: 'People updated' });
        }
        if (activityEntries.length === 0) {
            activityEntries.push({ type: 'DETAILS', message: 'Details updated' });
        }
        activityEntries.forEach((entry) => {
            nextActivityLog.push({
                id: Math.random().toString(36).substring(2, 15),
                type: entry.type,
                message: entry.message,
                timestamp: new Date(),
                actorId: command.principal.id,
            });
        });

        if (command.payload.isFavorite !== undefined) {
            const repoAny = this.repository as any;
            if (typeof repoAny.setFavoriteForUser === 'function') {
                await repoAny.setFavoriteForUser(
                    command.tenantId,
                    task.id,
                    command.principal.id,
                    command.payload.isFavorite
                );
            }
        }

        const updatedTask: Task = {
            ...task,
            title: command.payload.title ?? task.title,
            description: command.payload.description ?? task.description,
            kinds: normalizedKinds,
            priority: command.payload.priority ?? task.priority,
            dueDate: dueDateValue,
            ownerId: command.payload.ownerId === null
                ? null
                : (command.payload.ownerId ?? task.ownerId),
            assignees: command.payload.assignees ?? task.assignees,
            attachments: nextAttachments,
            comments: nextComments,
            checklist: nextChecklist,
            linkedTaskIds: command.payload.linkedTaskIds ?? task.linkedTaskIds,
            activityLog: nextActivityLog,
            isFavorite: task.isFavorite,
            excludeFromAll: command.payload.excludeFromAll ?? task.excludeFromAll,
            updatedAt: new Date(),
            version: task.version + 1,
        };

        await this.repository.save(updatedTask);
        return updatedTask;
    }

    protected getResourceId(command: UpdateTaskDetailsCommand): string {
        return command.payload.taskId;
    }

    protected getResourceType(): 'TASK' {
        return 'TASK';
    }

    protected getAuditAction(): AuditAction {
        return AuditAction.TASK_UPDATE;
    }

    protected getRequiredPermissions(): string[] {
        return ['task.update-details'];
    }

    protected getPolicyResource(command: UpdateTaskDetailsCommand): any {
        return (command as UpdateTaskDetailsCommand & { resourceTask?: Task }).resourceTask ?? command.payload;
    }
}
