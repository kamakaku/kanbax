import { PrismaClient } from '@prisma/client';
import { PolicyContext, PolicyContextRepository, TenantId } from '@kanbax/domain';
export declare class PolicyContextRepositoryPostgres implements PolicyContextRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    findById(id: string, tenantId: TenantId): Promise<PolicyContext | null>;
    save(context: PolicyContext): Promise<void>;
    delete(id: string, tenantId: TenantId): Promise<void>;
    private mapToDomain;
}
//# sourceMappingURL=policy-repository-postgres.d.ts.map