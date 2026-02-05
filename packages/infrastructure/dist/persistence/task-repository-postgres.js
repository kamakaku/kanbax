import { Prisma } from '@prisma/client';
export class TaskRepositoryPostgres {
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
        const updateData = {
            title: task.title,
            description: task.description,
            kind: task.kinds[0] ?? null,
            kinds: task.kinds,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate ?? null,
            ownerId: task.ownerId ?? null,
            excludeFromAll: task.excludeFromAll ?? false,
            assignees: task.assignees,
            labels: task.labels,
            attachments: task.attachments,
            comments: task.comments,
            checklist: task.checklist,
            linkedTaskIds: task.linkedTaskIds,
            activityLog: task.activityLog,
            isFavorite: task.isFavorite,
            source: task.source,
            policyContext: task.policyContext,
            updatedAt: new Date(),
            version: { increment: 1 },
        };
        const createData = {
            id: task.id,
            tenantId: task.tenantId,
            title: task.title,
            description: task.description,
            kind: task.kinds[0] ?? null,
            kinds: task.kinds,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate ?? null,
            ownerId: task.ownerId ?? null,
            excludeFromAll: task.excludeFromAll ?? false,
            assignees: task.assignees,
            labels: task.labels,
            attachments: task.attachments,
            comments: task.comments,
            checklist: task.checklist,
            linkedTaskIds: task.linkedTaskIds,
            activityLog: task.activityLog,
            isFavorite: task.isFavorite,
            source: task.source,
            policyContext: task.policyContext,
            version: 1,
        };
        await this.prisma.task.upsert({
            where: { id: task.id, tenantId: task.tenantId },
            update: updateData,
            create: createData,
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
    async findAllByTenant(tenantId) {
        const records = await this.prisma.task.findMany({
            where: { tenantId },
        });
        return records.map(this.mapToDomain);
    }
    async findFavoriteTaskIdsForUser(tenantId, userId) {
        const rows = await this.prisma.$queryRaw(Prisma.sql `
            select task_id
            from huddle_task_favorites
            where tenant_id = ${tenantId} and user_id = ${userId}
        `);
        return rows.map((row) => row.task_id);
    }
    async setFavoriteForUser(tenantId, taskId, userId, isFavorite) {
        if (isFavorite) {
            await this.prisma.$executeRaw(Prisma.sql `
                insert into huddle_task_favorites (tenant_id, task_id, user_id)
                values (${tenantId}, ${taskId}, ${userId})
                on conflict (tenant_id, task_id, user_id) do nothing
            `);
            return;
        }
        await this.prisma.$executeRaw(Prisma.sql `
            delete from huddle_task_favorites
            where tenant_id = ${tenantId} and task_id = ${taskId} and user_id = ${userId}
        `);
    }
    mapToDomain(record) {
        return {
            id: record.id,
            tenantId: record.tenantId,
            title: record.title,
            description: record.description,
            kinds: record.kinds ?? (record.kind ? [record.kind] : []),
            status: record.status,
            priority: record.priority,
            dueDate: record.dueDate ?? undefined,
            ownerId: record.ownerId ?? null,
            excludeFromAll: record.excludeFromAll ?? false,
            assignees: record.assignees,
            labels: record.labels,
            attachments: record.attachments ?? [],
            comments: record.comments ?? [],
            checklist: record.checklist ?? [],
            linkedTaskIds: record.linkedTaskIds ?? [],
            activityLog: record.activityLog ?? [],
            isFavorite: record.isFavorite ?? false,
            source: record.source,
            policyContext: record.policyContext,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            version: record.version,
        };
    }
}
//# sourceMappingURL=task-repository-postgres.js.map