import { PrismaClient } from '@prisma/client';
import { AuditEvent, AuditEventId, AuditEventRepository, TenantId } from '@kanbax/domain';
export declare class AuditEventRepositoryPostgres implements AuditEventRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    findById(id: AuditEventId, tenantId: TenantId): Promise<AuditEvent | null>;
    findAllByTenant(tenantId: TenantId, options?: {
        from?: Date;
        to?: Date;
    }): Promise<AuditEvent[]>;
    deleteBefore(date: Date, tenantId: TenantId): Promise<number>;
    log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;
    private mapToDomain;
}
//# sourceMappingURL=audit-repository-postgres.d.ts.map