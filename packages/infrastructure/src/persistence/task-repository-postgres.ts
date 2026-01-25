import { PrismaClient } from '@prisma/client';
import { Task, TaskId, TaskRepository, TenantId, TaskStatus, TaskPriority } from '@kanbax/domain';

export class TaskRepositoryPostgres implements TaskRepository {
    constructor(private prisma: PrismaClient) { }

    async findById(id: TaskId, tenantId: TenantId): Promise<Task | null> {
        const record = await this.prisma.task.findUnique({
            where: { id, tenantId },
        });

        if (!record) return null;

        return this.mapToDomain(record);
    }

    async save(task: Task): Promise<void> {
        const updateData: any = {
            title: task.title,
            description: task.description,
            kind: task.kinds[0] ?? null,
            kinds: task.kinds as any,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate ?? null,
            ownerId: task.ownerId ?? null,
            excludeFromAll: task.excludeFromAll ?? false,
            assignees: task.assignees,
            labels: task.labels,
            attachments: task.attachments as any,
            comments: task.comments as any,
            checklist: task.checklist as any,
            linkedTaskIds: task.linkedTaskIds as any,
            activityLog: task.activityLog as any,
            isFavorite: task.isFavorite,
            source: task.source as any,
            policyContext: task.policyContext as any,
            updatedAt: new Date(),
            version: { increment: 1 },
        };

        const createData: any = {
            id: task.id,
            tenantId: task.tenantId,
            title: task.title,
            description: task.description,
            kind: task.kinds[0] ?? null,
            kinds: task.kinds as any,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate ?? null,
            ownerId: task.ownerId ?? null,
            excludeFromAll: task.excludeFromAll ?? false,
            assignees: task.assignees,
            labels: task.labels,
            attachments: task.attachments as any,
            comments: task.comments as any,
            checklist: task.checklist as any,
            linkedTaskIds: task.linkedTaskIds as any,
            activityLog: task.activityLog as any,
            isFavorite: task.isFavorite,
            source: task.source as any,
            policyContext: task.policyContext as any,
            version: 1,
        };

        await this.prisma.task.upsert({
            where: { id: task.id, tenantId: task.tenantId },
            update: updateData,
            create: createData,
        });
    }

    async delete(id: TaskId, tenantId: TenantId): Promise<void> {
        await this.prisma.task.delete({
            where: { id, tenantId },
        });
    }

    async findAllByBoardId(boardId: string, tenantId: TenantId): Promise<Task[]> {
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

    async findAllByTenant(tenantId: TenantId): Promise<Task[]> {
        const records = await this.prisma.task.findMany({
            where: { tenantId },
        });

        return records.map(this.mapToDomain);
    }

    private mapToDomain(record: any): Task {
        return {
            id: record.id,
            tenantId: record.tenantId,
            title: record.title,
            description: record.description,
            kinds: (record.kinds as any) ?? (record.kind ? [record.kind] : []),
            status: record.status as TaskStatus,
            priority: record.priority as TaskPriority,
            dueDate: record.dueDate ?? undefined,
            ownerId: record.ownerId ?? null,
            excludeFromAll: record.excludeFromAll ?? false,
            assignees: record.assignees,
            labels: record.labels,
            attachments: (record.attachments as any) ?? [],
            comments: (record.comments as any) ?? [],
            checklist: (record.checklist as any) ?? [],
            linkedTaskIds: (record.linkedTaskIds as any) ?? [],
            activityLog: (record.activityLog as any) ?? [],
            isFavorite: record.isFavorite ?? false,
            source: record.source as any,
            policyContext: record.policyContext as any,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            version: record.version,
        };
    }
}
