import { AuditAction, PolicyContext, Task, TaskId, TaskAttachment, TaskChecklistItem, TaskPriority, UserId } from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';
export interface UpdateTaskDetailsCommand extends Command<{
    taskId: TaskId;
    title: string;
    description?: string;
    kind?: string;
    kinds?: string[];
    priority?: TaskPriority;
    dueDate?: string | null;
    ownerId?: UserId | null;
    assignees?: UserId[];
    attachmentsToAdd?: TaskAttachment[];
    attachmentsToRemove?: string[];
    commentText?: string;
    checklist?: TaskChecklistItem[];
    linkedTaskIds?: TaskId[];
    isFavorite?: boolean;
}> {
    type: 'TASK_UPDATE_DETAILS';
}
export declare class UpdateTaskDetailsPipeline extends CommandPipeline<UpdateTaskDetailsCommand, Task> {
    protected validate(command: UpdateTaskDetailsCommand): void;
    protected loadPolicyContext(command: UpdateTaskDetailsCommand): Promise<PolicyContext>;
    protected handle(command: UpdateTaskDetailsCommand, _context: PolicyContext): Promise<Task>;
    protected getResourceId(command: UpdateTaskDetailsCommand): string;
    protected getResourceType(): 'TASK';
    protected getAuditAction(): AuditAction;
    protected getRequiredPermissions(): string[];
    protected getPolicyResource(command: UpdateTaskDetailsCommand): any;
}
//# sourceMappingURL=update-task-details-pipeline.d.ts.map