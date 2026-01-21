"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditEventRepositoryPostgres = void 0;
class AuditEventRepositoryPostgres {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id, tenantId) {
        const record = await this.prisma.auditEvent.findUnique({
            where: { id, tenantId },
        });
        if (!record)
            return null;
        return this.mapToDomain(record);
    }
    async findAllByTenant(tenantId, options) {
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
    async deleteBefore(date, tenantId) {
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
    async log(event) {
        await this.prisma.auditEvent.create({
            data: {
                tenantId: event.tenantId,
                actorId: event.actorId,
                actorType: event.actorType,
                actorRole: event.actorRole,
                action: event.action,
                resourceId: event.resourceId,
                resourceType: event.resourceType,
                payload: event.payload,
                policyDecision: event.policyDecision,
                metadata: event.metadata,
            },
        });
    }
    mapToDomain(record) {
        return {
            id: record.id,
            timestamp: record.timestamp,
            actorId: record.actorId,
            actorType: record.actorType,
            actorRole: record.actorRole,
            tenantId: record.tenantId,
            action: record.action,
            resourceId: record.resourceId,
            resourceType: record.resourceType,
            payload: record.payload,
            policyDecision: record.policyDecision,
            metadata: record.metadata,
        };
    }
}
exports.AuditEventRepositoryPostgres = AuditEventRepositoryPostgres;
//# sourceMappingURL=audit-repository-postgres.js.map