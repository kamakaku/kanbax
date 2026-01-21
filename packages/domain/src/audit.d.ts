import { UserId, TenantId } from './task';
import { PrincipalType } from './identity';
export type AuditEventId = string;
export declare enum AuditAction {
    TASK_CREATE = "TASK_CREATE",
    TASK_UPDATE = "TASK_UPDATE",
    TASK_DELETE = "TASK_DELETE",
    POLICY_EVALUATE = "POLICY_EVALUATE",
    ACCESS_DENIED = "ACCESS_DENIED"
}
export interface AuditEvent {
    id: AuditEventId;
    timestamp: Date;
    actorId: UserId;
    actorType: PrincipalType;
    actorRole?: string;
    tenantId: TenantId;
    action: AuditAction;
    resourceId: string;
    resourceType: 'TASK' | 'BOARD' | 'POLICY';
    payload: Record<string, any>;
    policyDecision?: {
        policyId: string;
        outcome: 'ALLOW' | 'DENY';
        reason?: string;
    };
    metadata: {
        ipAddress?: string;
        userAgent?: string;
        tenantId: string;
    };
}
export interface AuditLogger {
    log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;
}
export interface AuditEventRepository {
    findById(id: AuditEventId, tenantId: TenantId): Promise<AuditEvent | null>;
    findAllByTenant(tenantId: TenantId, options?: {
        from?: Date;
        to?: Date;
    }): Promise<AuditEvent[]>;
    deleteBefore(date: Date, tenantId: TenantId): Promise<number>;
}
//# sourceMappingURL=audit.d.ts.map