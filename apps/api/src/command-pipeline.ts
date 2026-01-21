import {
    AuditAction,
    AuditLogger,
    PolicyContext,
    PolicyEngine,
    TaskRepository,
    UserId,
    Task,
    TenantId,
    Principal,
    PrincipalType
} from '@kanbax/domain';

export class AuthorizationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthorizationError';
    }
}

export interface Command<T = any> {
    type: string;
    principal: Principal;
    tenantId: TenantId;
    payload: T;
}

export abstract class CommandPipeline<TCommand extends Command, TResult> {
    constructor(
        protected readonly policyEngine: PolicyEngine,
        protected readonly auditLogger: AuditLogger,
        protected readonly repository: TaskRepository
    ) { }

    async execute(command: TCommand): Promise<TResult> {
        // 1. Validate command shape (basic check)
        this.validate(command);

        // 2. Authorize via Roles & Permissions
        const authorized = await this.authorize(command);
        if (!authorized) {
            await this.auditLogger.log({
                actorId: command.principal.id,
                actorType: command.principal.type as any,
                tenantId: command.tenantId,
                action: AuditAction.ACCESS_DENIED,
                resourceId: this.getResourceId(command),
                resourceType: this.getResourceType(),
                payload: command.payload,
                policyDecision: {
                    policyId: 'RBAC',
                    outcome: 'DENY',
                    reason: 'Missing required permissions',
                },
                metadata: { tenantId: command.tenantId },
            });
            throw new AuthorizationError(`Authorization Failed: Missing required permissions for ${command.type}`);
        }

        // 3. Load PolicyContext
        const policyContext = await this.loadPolicyContext(command);

        // 4. Evaluate policy
        const decision = await this.policyEngine.evaluate(
            command.principal.id,
            command.type,
            policyContext,
            this.getPolicyResource(command, policyContext)
        );

        // 5. If denied
        if (!decision.allowed) {
            await this.auditLogger.log({
                actorId: command.principal.id,
                actorType: command.principal.type as any,
                tenantId: command.tenantId,
                action: AuditAction.ACCESS_DENIED,
                resourceId: this.getResourceId(command),
                resourceType: this.getResourceType(),
                payload: command.payload,
                policyDecision: {
                    policyId: decision.matchedRules[0]?.id || 'unknown',
                    outcome: 'DENY',
                    reason: decision.reason,
                },
                metadata: { tenantId: command.tenantId },
            });
            throw new Error(`Access Denied: ${decision.reason}`);
        }

        // 5. If allowed
        try {
            const result = await this.handle(command, policyContext);

            await this.auditLogger.log({
                actorId: command.principal.id,
                actorType: command.principal.type as any,
                tenantId: command.tenantId,
                action: this.getAuditAction(),
                resourceId: this.getResourceId(command),
                resourceType: this.getResourceType(),
                payload: command.payload,
                policyDecision: {
                    policyId: decision.matchedRules[0]?.id || 'unknown',
                    outcome: 'ALLOW',
                },
                metadata: { tenantId: command.tenantId },
            });

            return result;
        } catch (error) {
            // Log failure if necessary
            throw error;
        }
    }

    protected async authorize(command: TCommand): Promise<boolean> {
        const requiredPermissions = this.getRequiredPermissions();
        if (requiredPermissions.length === 0) return true;

        const principalPermissions = new Set(
            command.principal.roles.flatMap((role: any) => role.permissions.map((p: any) => p.name))
        );

        return requiredPermissions.every(permission => principalPermissions.has(permission));
    }

    protected abstract validate(command: TCommand): void;
    protected abstract getRequiredPermissions(): string[];
    protected abstract loadPolicyContext(command: TCommand): Promise<PolicyContext>;
    protected abstract handle(command: TCommand, context: PolicyContext): Promise<TResult>;
    protected abstract getResourceId(command: TCommand): string;
    protected abstract getResourceType(): 'TASK' | 'BOARD' | 'POLICY';
    protected abstract getAuditAction(): AuditAction;

    protected getPolicyResource(command: TCommand, _context: PolicyContext): any {
        return command.payload;
    }
}
