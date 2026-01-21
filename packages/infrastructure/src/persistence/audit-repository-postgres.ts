import { PrismaClient } from '@prisma/client';
import { AuditEvent, AuditEventId, AuditEventRepository, TenantId, AuditAction } from '@kanbax/domain';

export class AuditEventRepositoryPostgres implements AuditEventRepository {
    constructor(private prisma: PrismaClient) { }

    async findById(id: AuditEventId, tenantId: TenantId): Promise<AuditEvent | null> {
        const record = await this.prisma.auditEvent.findUnique({
            where: { id, tenantId },
        });

        if (!record) return null;

        return this.mapToDomain(record);
    }

    async findAllByTenant(tenantId: TenantId, options?: { from?: Date; to?: Date }): Promise<AuditEvent[]> {
        const records = await this.prisma.auditEvent.findMany({
            where: {
                tenantId,
                timestamp: {
                    gte: options?.from,
                    lte: options?.to,
                },
            },
            orderBy: { timestamp: 'desc' },
        });

        return records.map(this.mapToDomain);
    }

    async deleteBefore(date: Date, tenantId: TenantId): Promise<number> {
        // Bank-grade: Audit events are usually not deleted, but for retention we might need to.
        // This is strictly scoped by tenant.
        const result = await this.prisma.auditEvent.deleteMany({
            where: {
                tenantId,
                timestamp: {
                    lt: date,
                },
            },
        });
        return result.count;
    }

    async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
        await this.prisma.auditEvent.create({
            data: {
                tenantId: event.tenantId,
                actorId: event.actorId,
                actorType: event.actorType,
                actorRole: event.actorRole,
                action: event.action,
                resourceId: event.resourceId,
                resourceType: event.resourceType,
                payload: event.payload as any,
                policyDecision: event.policyDecision as any,
                metadata: event.metadata as any,
            },
        });
    }

    private mapToDomain(record: any): AuditEvent {
        return {
            id: record.id,
            timestamp: record.timestamp,
            actorId: record.actorId,
            actorType: record.actorType as any,
            actorRole: record.actorRole,
            tenantId: record.tenantId,
            action: record.action as AuditAction,
            resourceId: record.resourceId,
            resourceType: record.resourceType as any,
            payload: record.payload as any,
            policyDecision: record.policyDecision as any,
            metadata: record.metadata as any,
        };
    }
}
