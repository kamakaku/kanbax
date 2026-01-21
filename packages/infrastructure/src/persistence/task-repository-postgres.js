"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRepositoryPostgres = void 0;
class TaskRepositoryPostgres {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id, tenantId) {
        const record = await this.prisma.task.findUnique({
            where: { id, tenantId },
        });
        if (!record)
            return null;
        return this.mapToDomain(record);
    }
    async save(task) {
        await this.prisma.task.upsert({
            where: { id: task.id, tenantId: task.tenantId },
            update: {
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                assignees: task.assignees,
                labels: task.labels,
                source: task.source,
                policyContext: task.policyContext,
                updatedAt: new Date(),
                version: { increment: 1 },
            },
            create: {
                id: task.id,
                tenantId: task.tenantId,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                assignees: task.assignees,
                labels: task.labels,
                source: task.source,
                policyContext: task.policyContext,
                version: 1,
            },
        });
    }
    async delete(id, tenantId) {
        await this.prisma.task.delete({
            where: { id, tenantId },
        });
    }
    async findAllByBoardId(boardId, tenantId) {
        const records = await this.prisma.task.findMany({
            where: {
                tenantId,
                policyContext: {
                    path: ['scopeId'],
                    equals: boardId,
                },
            },
        });
        return records.map(this.mapToDomain);
    }
    mapToDomain(record) {
        return {
            id: record.id,
            tenantId: record.tenantId,
            title: record.title,
            description: record.description,
            status: record.status,
            priority: record.priority,
            assignees: record.assignees,
            labels: record.labels,
            source: record.source,
            policyContext: record.policyContext,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            version: record.version,
        };
    }
}
exports.TaskRepositoryPostgres = TaskRepositoryPostgres;
//# sourceMappingURL=task-repository-postgres.js.map