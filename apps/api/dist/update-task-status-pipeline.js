import { AuditAction } from '@kanbax/domain';
import { CommandPipeline } from './command-pipeline.js';
export class UpdateTaskStatusPipeline extends CommandPipeline {
    validate(command) {
        if (!command.payload.taskId)
            throw new Error('Task ID is required');
        if (!command.payload.newStatus)
            throw new Error('New status is required');
    }
    async loadPolicyContext(command) {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task)
            throw new Error('Task not found or access denied');
        // Reuse the policy context from the task itself or fetch a fresh one.
        // Back-compat: allow legacy TASK_UPDATE policy rules to satisfy TASK_UPDATE_STATUS.
        const hasUpdateStatusRule = task.policyContext.rules.some((rule) => rule.action === 'TASK_UPDATE_STATUS');
        const legacyUpdateRules = task.policyContext.rules.filter((rule) => rule.action === 'TASK_UPDATE');
        command.resourceTask = task;
        let normalizedContext = task.policyContext;
        if (!hasUpdateStatusRule && legacyUpdateRules.length > 0) {
            normalizedContext = {
                ...task.policyContext,
                rules: [
                    ...task.policyContext.rules,
                    ...legacyUpdateRules.map((rule, index) => ({
                        ...rule,
                        id: `${rule.id}-status-${index + 1}`,
                        action: 'TASK_UPDATE_STATUS',
                    })),
                ],
            };
        }
        if (!normalizedContext.rules.some((rule) => rule.action === 'TASK_UPDATE_STATUS')) {
            normalizedContext = {
                ...normalizedContext,
                rules: [
                    ...normalizedContext.rules,
                    {
                        id: 'rule-update-status-manual',
                        action: 'TASK_UPDATE_STATUS',
                        effect: 'ALLOW',
                        condition: 'resource.source.type=MANUAL',
                    },
                ],
            };
        }
        return normalizedContext;
    }
    async handle(command, context) {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task)
            throw new Error('Task not found');
        // Structural check: Jira tasks cannot be updated in UI (as per scope)
        if (task.source.type !== 'MANUAL') {
            throw new Error('Only manual tasks can be updated in the UI');
        }
        const updatedTask = {
            ...task,
            status: command.payload.newStatus,
            activityLog: [
                ...(task.activityLog ?? []),
                {
                    id: Math.random().toString(36).substring(2, 15),
                    type: 'STATUS',
                    message: `Status changed to ${command.payload.newStatus}`,
                    timestamp: new Date(),
                    actorId: command.principal.id,
                },
            ],
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
        return ['task.update-status'];
    }
    getPolicyResource(command) {
        return command.resourceTask ?? command.payload;
    }
}
//# sourceMappingURL=update-task-status-pipeline.js.map