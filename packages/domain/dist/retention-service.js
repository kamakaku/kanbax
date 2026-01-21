export class RetentionService {
    taskRepository;
    auditRepository;
    constructor(taskRepository, auditRepository) {
        this.taskRepository = taskRepository;
        this.auditRepository = auditRepository;
    }
    async runRetention(tenantId, policy, dryRun = false) {
        const now = new Date();
        let deletedTasks = 0;
        let deletedAuditEvents = 0;
        if (policy.retentionDays) {
            const cutoffDate = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
            console.log(`[Retention] Running for tenant ${tenantId}, cutoff: ${cutoffDate.toISOString()}, dryRun: ${dryRun}`);
            // In a real implementation, we would have a way to find tasks by age in the repository.
            // For this phase, we'll assume the repository has a deleteBefore method or similar.
            // Since TaskRepository doesn't have it yet, I'll add it or simulate it.
            // deletedAuditEvents = await this.auditRepository.deleteBefore(cutoffDate, tenantId);
            if (!dryRun) {
                deletedAuditEvents = await this.auditRepository.deleteBefore(cutoffDate, tenantId);
                // deletedTasks = await (this.taskRepository as any).deleteBefore(cutoffDate, tenantId);
            }
            else {
                console.log(`[Retention][DryRun] Would delete audit events before ${cutoffDate.toISOString()}`);
            }
        }
        return { deletedTasks, deletedAuditEvents };
    }
}
//# sourceMappingURL=retention-service.js.map