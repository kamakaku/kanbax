import { AuditAction, TaskPriority, TaskStatus } from '@kanbax/domain';
import { CommandPipeline } from './command-pipeline.js';
export class IngestEmailPipeline extends CommandPipeline {
    emailAdapter;
    constructor(policyEngine, auditLogger, repository, emailAdapter) {
        super(policyEngine, auditLogger, repository);
        this.emailAdapter = emailAdapter;
    }
    validate(command) {
        if (!command.payload.messageId)
            throw new Error('Message ID is required');
        if (!command.payload.boardId)
            throw new Error('Board ID is required');
    }
    async loadPolicyContext(command) {
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
    async handle(command, context) {
        const metadata = await this.emailAdapter.extractMetadata(command.payload);
        const task = {
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
    getResourceId(command) {
        return command.payload.messageId;
    }
    getResourceType() {
        return 'TASK';
    }
    getAuditAction() {
        return AuditAction.TASK_CREATE;
    }
    getRequiredPermissions() {
        return ['task.create'];
    }
}
//# sourceMappingURL=ingest-email-pipeline.js.map