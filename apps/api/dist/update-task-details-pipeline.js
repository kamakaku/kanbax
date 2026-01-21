import { AuditAction } from '@kanbax/domain';
import { CommandPipeline } from './command-pipeline.js';
export class UpdateTaskDetailsPipeline extends CommandPipeline {
    validate(command) {
        if (!command.payload.taskId)
            throw new Error('Task ID is required');
        if (!command.payload.title)
            throw new Error('Title is required');
    }
    async loadPolicyContext(command) {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task)
            throw new Error('Task not found or access denied');
        command.resourceTask = task;
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
    async handle(command, _context) {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task)
            throw new Error('Task not found');
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
        const activityEntries = [];
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
        const updatedTask = {
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
            isFavorite: command.payload.isFavorite ?? task.isFavorite,
            updatedAt: new Date(),
            version: task.version + 1,
        };
        await this.repository.save(updatedTask);
        return updatedTask;
    }
    getResourceId(command) {
        return command.payload.taskId;
    }
    getResourceType() {
        return 'TASK';
    }
    getAuditAction() {
        return AuditAction.TASK_UPDATE;
    }
    getRequiredPermissions() {
        return ['task.update-details'];
    }
    getPolicyResource(command) {
        return command.resourceTask ?? command.payload;
    }
}
//# sourceMappingURL=update-task-details-pipeline.js.map