import {
    AuditAction,
    PolicyContext,
    Task,
    TaskId,
    TenantId
} from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';

export interface DeleteTaskCommand extends Command<{
    taskId: TaskId;
}> {
    type: 'TASK_DELETE';
}

export class DeleteTaskPipeline extends CommandPipeline<DeleteTaskCommand, void> {
    protected validate(command: DeleteTaskCommand): void {
        if (!command.payload.taskId) throw new Error('Task ID is required');
    }

    protected async loadPolicyContext(command: DeleteTaskCommand): Promise<PolicyContext> {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task) throw new Error('Task not found or access denied');

        (command as DeleteTaskCommand & { resourceTask?: Task }).resourceTask = task;

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

    protected async handle(command: DeleteTaskCommand, context: PolicyContext): Promise<void> {
        const task = await this.repository.findById(command.payload.taskId, command.tenantId);
        if (!task) throw new Error('Task not found');

        // Structural check: Jira tasks cannot be deleted in UI (as per scope)
        if (task.source.type !== 'MANUAL') {
            throw new Error('Only manual tasks can be deleted in the UI');
        }

        await this.repository.delete(command.payload.taskId, command.tenantId);
    }

    protected getResourceId(command: DeleteTaskCommand): string {
        return command.payload.taskId;
    }

    protected getResourceType(): 'TASK' {
        return 'TASK';
    }

    protected getAuditAction(): AuditAction {
        return AuditAction.TASK_DELETE;
    }

    protected getRequiredPermissions(): string[] {
        return ['task.delete'];
    }

    protected getPolicyResource(command: DeleteTaskCommand): any {
        return (command as DeleteTaskCommand & { resourceTask?: Task }).resourceTask ?? command.payload;
    }
}
