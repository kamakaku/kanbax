"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestEmailPipeline = void 0;
const domain_1 = require("@kanbax/domain");
const command_pipeline_1 = require("./command-pipeline");
class IngestEmailPipeline extends command_pipeline_1.CommandPipeline {
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
            status: domain_1.TaskStatus.TODO,
            priority: domain_1.TaskPriority.MEDIUM,
            assignees: [],
            labels: [],
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
        return domain_1.AuditAction.TASK_CREATE;
    }
}
exports.IngestEmailPipeline = IngestEmailPipeline;
//# sourceMappingURL=ingest-email-pipeline.js.map