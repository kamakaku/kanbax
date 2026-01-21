import { AuditAction } from '@kanbax/domain';
import { CommandPipeline } from './command-pipeline.js';
export class DeleteTaskPipeline extends CommandPipeline {
    validate(command) {
        if (!command.payload.taskId)
            throw new Error('Task ID is required');
    }
    async loadPolicyContext(command) {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task)
            throw new Error('Task not found or access denied');
        command.resourceTask = task;
        const hasDeleteRule = task.policyContext.rules.some((rule) => rule.action === 'TASK_DELETE');
        if (!hasDeleteRule) {
            return {
                ...task.policyContext,
                rules: [
                    ...task.policyContext.rules,
                    {
                        id: 'rule-delete-manual',
                        action: 'TASK_DELETE',
                        effect: 'ALLOW',
                        condition: 'resource.source.type=MANUAL',
                    },
                ],
            };
        }
        return task.policyContext;
    }
    async handle(command, context) {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task)
            throw new Error('Task not found');
        // Structural check: Jira tasks cannot be deleted in UI (as per scope)
        if (task.source.type !== 'MANUAL') {
            throw new Error('Only manual tasks can be deleted in the UI');
        }
        await this.repository.delete(command.payload.taskId, command.tenantId);
    }
    getResourceId(command) {
        return command.payload.taskId;
    }
    getResourceType() {
        return 'TASK';
    }
    getAuditAction() {
        return AuditAction.TASK_DELETE;
    }
    getRequiredPermissions() {
        return ['task.delete'];
    }
    getPolicyResource(command) {
        return command.resourceTask ?? command.payload;
    }
}
//# sourceMappingURL=delete-task-pipeline.js.map