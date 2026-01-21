import { AuditAction, AuditLogger, PolicyContext, PolicyEngine, TaskRepository, TenantId, Principal } from '@kanbax/domain';
export declare class AuthorizationError extends Error {
    constructor(message: string);
}
export interface Command<T = any> {
    type: string;
    principal: Principal;
    tenantId: TenantId;
    payload: T;
}
export declare abstract class CommandPipeline<TCommand extends Command, TResult> {
    protected readonly policyEngine: PolicyEngine;
    protected readonly auditLogger: AuditLogger;
    protected readonly repository: TaskRepository;
    constructor(policyEngine: PolicyEngine, auditLogger: AuditLogger, repository: TaskRepository);
    execute(command: TCommand): Promise<TResult>;
    protected authorize(command: TCommand): Promise<boolean>;
    protected abstract validate(command: TCommand): void;
    protected abstract getRequiredPermissions(): string[];
    protected abstract loadPolicyContext(command: TCommand): Promise<PolicyContext>;
    protected abstract handle(command: TCommand, context: PolicyContext): Promise<TResult>;
    protected abstract getResourceId(command: TCommand): string;
    protected abstract getResourceType(): 'TASK' | 'BOARD' | 'POLICY';
    protected abstract getAuditAction(): AuditAction;
}
//# sourceMappingURL=command-pipeline.d.ts.map