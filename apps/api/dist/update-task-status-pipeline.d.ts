import { AuditAction, PolicyContext, Task, TaskId, TaskStatus } from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';
export interface UpdateTaskStatusCommand extends Command<{
    taskId: TaskId;
    newStatus: TaskStatus;
}> {
    type: 'TASK_UPDATE_STATUS';
}
export declare class UpdateTaskStatusPipeline extends CommandPipeline<UpdateTaskStatusCommand, Task> {
    protected validate(command: UpdateTaskStatusCommand): void;
    protected loadPolicyContext(command: UpdateTaskStatusCommand): Promise<PolicyContext>;
    protected handle(command: UpdateTaskStatusCommand, context: PolicyContext): Promise<Task>;
    protected getResourceId(command: UpdateTaskStatusCommand): string;
    protected getResourceType(): 'TASK';
    protected getAuditAction(): AuditAction;
    protected getRequiredPermissions(): string[];
    protected getPolicyResource(command: UpdateTaskStatusCommand): any;
}
//# sourceMappingURL=update-task-status-pipeline.d.ts.map