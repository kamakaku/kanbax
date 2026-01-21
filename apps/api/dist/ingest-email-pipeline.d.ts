import { AuditAction, PolicyContext, Task, EmailIngestAdapter } from '@kanbax/domain';
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
export declare class IngestEmailPipeline extends CommandPipeline<IngestEmailCommand, Task> {
    private emailAdapter;
    constructor(policyEngine: any, auditLogger: any, repository: any, emailAdapter: EmailIngestAdapter);
    protected validate(command: IngestEmailCommand): void;
    protected loadPolicyContext(command: IngestEmailCommand): Promise<PolicyContext>;
    protected handle(command: IngestEmailCommand, context: PolicyContext): Promise<Task>;
    protected getResourceId(command: IngestEmailCommand): string;
    protected getResourceType(): 'TASK';
    protected getAuditAction(): AuditAction;
    protected getRequiredPermissions(): string[];
}
//# sourceMappingURL=ingest-email-pipeline.d.ts.map