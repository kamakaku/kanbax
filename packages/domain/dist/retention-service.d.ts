import { TaskRepository, TenantId, PolicyContext } from './task';
import { AuditEventRepository } from './audit';
export declare class RetentionService {
    private taskRepository;
    private auditRepository;
    constructor(taskRepository: TaskRepository, auditRepository: AuditEventRepository);
    runRetention(tenantId: TenantId, policy: PolicyContext, dryRun?: boolean): Promise<{
        deletedTasks: number;
        deletedAuditEvents: number;
    }>;
}
//# sourceMappingURL=retention-service.d.ts.map