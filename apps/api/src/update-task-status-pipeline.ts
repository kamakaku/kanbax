import {
    AuditAction,
    PolicyContext,
    Task,
    TaskId,
    TaskStatus,
    TenantId
} from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';

export interface UpdateTaskStatusCommand extends Command<{
    taskId: TaskId;
    newStatus: TaskStatus;
}> {
    type: 'TASK_UPDATE_STATUS';
}

export class UpdateTaskStatusPipeline extends CommandPipeline<UpdateTaskStatusCommand, Task> {
    protected validate(command: UpdateTaskStatusCommand): void {
        if (!command.payload.taskId) throw new Error('Task ID is required');
        if (!command.payload.newStatus) throw new Error('New status is required');
    }

    protected async loadPolicyContext(command: UpdateTaskStatusCommand): Promise<PolicyContext> {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task) throw new Error('Task not found or access denied');

        // Reuse the policy context from the task itself or fetch a fresh one.
        // Back-compat: allow legacy TASK_UPDATE policy rules to satisfy TASK_UPDATE_STATUS.
        const hasUpdateStatusRule = task.policyContext.rules.some((rule) => rule.action === 'TASK_UPDATE_STATUS');
        const legacyUpdateRules = task.policyContext.rules.filter((rule) => rule.action === 'TASK_UPDATE');

        (command as UpdateTaskStatusCommand & { resourceTask?: Task }).resourceTask = task;

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

    protected async handle(command: UpdateTaskStatusCommand, context: PolicyContext): Promise<Task> {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task) throw new Error('Task not found');

        // Structural check: Jira tasks cannot be updated in UI (as per scope)
        if (task.source.type !== 'MANUAL') {
            throw new Error('Only manual tasks can be updated in the UI');
        }

        const updatedTask: Task = {
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

    protected getResourceId(command: UpdateTaskStatusCommand): string {
        return command.payload.taskId;
    }

    protected getResourceType(): 'TASK' {
        return 'TASK';
    }

    protected getAuditAction(): AuditAction {
        return AuditAction.TASK_UPDATE;
    }

    protected getRequiredPermissions(): string[] {
        return ['task.update-status'];
    }

    protected getPolicyResource(command: UpdateTaskStatusCommand): any {
        return (command as UpdateTaskStatusCommand & { resourceTask?: Task }).resourceTask ?? command.payload;
    }
}
