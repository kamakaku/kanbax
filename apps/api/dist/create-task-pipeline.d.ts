import { AuditAction, PolicyContext, Task, TaskId, TaskPriority, TaskStatus, TaskSource, TaskAttachment, TaskChecklistItem, TaskComment, UserId } from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';
export interface CreateTaskCommand extends Command<{
    title: string;
    description?: string;
    kind?: string;
    kinds?: string[];
    boardId: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    ownerId?: UserId | null;
    assignees?: UserId[];
    attachments?: TaskAttachment[];
    comments?: TaskComment[];
    checklist?: TaskChecklistItem[];
    linkedTaskIds?: TaskId[];
    source: TaskSource;
    isFavorite?: boolean;
    excludeFromAll?: boolean;
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
    protected getRequiredPermissions(): string[];
}
//# sourceMappingURL=create-task-pipeline.d.ts.map