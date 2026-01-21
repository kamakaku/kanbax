import { AuditAction, PolicyContext, TaskId } from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';
export interface DeleteTaskCommand extends Command<{
    taskId: TaskId;
}> {
    type: 'TASK_DELETE';
}
export declare class DeleteTaskPipeline extends CommandPipeline<DeleteTaskCommand, void> {
    protected validate(command: DeleteTaskCommand): void;
    protected loadPolicyContext(command: DeleteTaskCommand): Promise<PolicyContext>;
    protected handle(command: DeleteTaskCommand, context: PolicyContext): Promise<void>;
    protected getResourceId(command: DeleteTaskCommand): string;
    protected getResourceType(): 'TASK';
    protected getAuditAction(): AuditAction;
    protected getRequiredPermissions(): string[];
    protected getPolicyResource(command: DeleteTaskCommand): any;
}
//# sourceMappingURL=delete-task-pipeline.d.ts.map