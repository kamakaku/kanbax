import { AuditAction, PolicyContext, Task, TaskSource, TaskPriority, TaskStatus, TaskAttachment, TaskChecklistItem, TaskComment } from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline';
export interface CreateTaskCommand extends Command<{
    title: string;
    description?: string;
    kind?: string;
    kinds?: string[];
    boardId: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    ownerId?: string | null;
    assignees?: string[];
    attachments?: TaskAttachment[];
    comments?: TaskComment[];
    checklist?: TaskChecklistItem[];
    linkedTaskIds?: string[];
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
}
//# sourceMappingURL=create-task-pipeline.d.ts.map
