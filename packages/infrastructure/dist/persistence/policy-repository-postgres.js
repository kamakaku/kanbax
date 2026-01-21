export class PolicyContextRepositoryPostgres {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id, tenantId) {
        const record = await this.prisma.policyContext.findUnique({
            where: { id, tenantId },
        });
        if (!record)
            return null;
        return this.mapToDomain(record);
    }
    async save(context) {
        // Note: In this simplified model, we use scopeId as the unique identifier for simplicity in some cases,
        // but here we use the provided id if it exists.
        const id = context.id || Math.random().toString(36).substring(2, 15);
        await this.prisma.policyContext.upsert({
            where: { id, tenantId: context.tenantId },
            update: {
                scope: context.scope,
                scopeId: context.scopeId,
                rules: context.rules,
                auditLevel: context.auditLevel,
                updatedAt: new Date(),
            },
            create: {
                id,
                tenantId: context.tenantId,
                scope: context.scope,
                scopeId: context.scopeId,
                rules: context.rules,
                auditLevel: context.auditLevel,
            },
        });
    }
    async delete(id, tenantId) {
        await this.prisma.policyContext.delete({
            where: { id, tenantId },
        });
    }
    mapToDomain(record) {
        return {
            tenantId: record.tenantId,
            scope: record.scope,
            scopeId: record.scopeId,
            rules: record.rules,
            auditLevel: record.auditLevel,
        };
    }
}
//# sourceMappingURL=policy-repository-postgres.js.map