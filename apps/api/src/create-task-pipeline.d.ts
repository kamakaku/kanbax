import { AuditAction, PolicyContext, Task, TaskSource } from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline';
export interface CreateTaskCommand extends Command<{
    title: string;
    description?: string;
    boardId: string;
    source: TaskSource;
}> {
    type: 'TASK_CREATE';
}
export declare class CreateTaskPipeline extends CommandPipeline<CreateTaskCommand, Task> {
    protected validate(command: CreateTaskCommand): void;
    protected loadPolicyContext(command: CreateTaskCommand): Promise<PolicyContext>;
    protected handle(command: CreateTaskCommand, context: PolicyContext): Promise<Task>;
    protected getResourceId(command: CreateTaskCommand): string;
    protected getResourceType(): 'TASK';
    protected getAuditAction(): AuditAction;
}
//# sourceMappingURL=create-task-pipeline.d.ts.map