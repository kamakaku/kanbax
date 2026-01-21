import { PrismaClient } from '@prisma/client';
import { PolicyContext, PolicyContextRepository, TenantId } from '@kanbax/domain';

export class PolicyContextRepositoryPostgres implements PolicyContextRepository {
    constructor(private prisma: PrismaClient) { }

    async findById(id: string, tenantId: TenantId): Promise<PolicyContext | null> {
        const record = await this.prisma.policyContext.findUnique({
            where: { id, tenantId },
        });

        if (!record) return null;

        return this.mapToDomain(record);
    }

    async save(context: PolicyContext): Promise<void> {
        // Note: In this simplified model, we use scopeId as the unique identifier for simplicity in some cases,
        // but here we use the provided id if it exists.
        const id = (context as any).id || Math.random().toString(36).substring(2, 15);

        await this.prisma.policyContext.upsert({
            where: { id, tenantId: context.tenantId },
            update: {
                scope: context.scope,
                scopeId: context.scopeId,
                rules: context.rules as any,
                auditLevel: context.auditLevel,
                updatedAt: new Date(),
            },
            create: {
                id,
                tenantId: context.tenantId,
                scope: context.scope,
                scopeId: context.scopeId,
                rules: context.rules as any,
                auditLevel: context.auditLevel,
            },
        });
    }

    async delete(id: string, tenantId: TenantId): Promise<void> {
        await this.prisma.policyContext.delete({
            where: { id, tenantId },
        });
    }

    private mapToDomain(record: any): PolicyContext {
        return {
            tenantId: record.tenantId,
            scope: record.scope as any,
            scopeId: record.scopeId,
            rules: record.rules as any,
            auditLevel: record.auditLevel as any,
        };
    }
}
