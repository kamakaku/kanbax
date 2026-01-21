import {
    AuditAction,
    PolicyContext,
    Task,
    TaskId,
    TaskPriority,
    TaskStatus,
    TaskSource,
    TenantId,
    EmailIngestAdapter
} from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';

export interface IngestEmailCommand extends Command<{
    subject: string;
    sender: string;
    receivedAt: string;
    messageId: string;
    boardId: string;
}> {
    type: 'EMAIL_INGEST_METADATA';
}

export class IngestEmailPipeline extends CommandPipeline<IngestEmailCommand, Task> {
    constructor(
        policyEngine: any,
        auditLogger: any,
        repository: any,
        private emailAdapter: EmailIngestAdapter
    ) {
        super(policyEngine, auditLogger, repository);
    }

    protected validate(command: IngestEmailCommand): void {
        if (!command.payload.messageId) throw new Error('Message ID is required');
        if (!command.payload.boardId) throw new Error('Board ID is required');
    }

    protected async loadPolicyContext(command: IngestEmailCommand): Promise<PolicyContext> {
        return {
            tenantId: command.tenantId,
            scope: 'BOARD',
            scopeId: command.payload.boardId,
            rules: [
                { id: 'email-ingest-1', action: 'EMAIL_INGEST_METADATA', effect: 'ALLOW' }
            ],
            auditLevel: 'FULL',
        };
    }

    protected async handle(command: IngestEmailCommand, context: PolicyContext): Promise<Task> {
        const metadata = await this.emailAdapter.extractMetadata(command.payload);

        const task: Task = {
            id: Math.random().toString(36).substring(2, 15),
            tenantId: command.tenantId,
            title: metadata.subject,
            status: TaskStatus.TODO,
            priority: TaskPriority.MEDIUM,
            dueDate: undefined,
            assignees: [],
            labels: [],
            kinds: [],
            attachments: [],
            comments: [],
            checklist: [],
            linkedTaskIds: [],
            activityLog: [],
            isFavorite: false,
            source: {
                type: 'EMAIL',
                messageId: metadata.messageId,
                sender: metadata.sender,
                receivedAt: metadata.receivedAt,
                contentMode: 'metadata',
            },
            policyContext: context,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
        };

        await this.repository.save(task);
        return task;
    }

    protected getResourceId(command: IngestEmailCommand): string {
        return command.payload.messageId;
    }

    protected getResourceType(): 'TASK' {
        return 'TASK';
    }

    protected getAuditAction(): AuditAction {
        return AuditAction.TASK_CREATE;
    }

    protected getRequiredPermissions(): string[] {
        return ['task.create'];
    }
}
