import { PrismaClient } from '@prisma/client';
import { Task, TaskId, TaskRepository, TenantId } from '@kanbax/domain';
export declare class TaskRepositoryPostgres implements TaskRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    findById(id: TaskId, tenantId: TenantId): Promise<Task | null>;
    save(task: Task): Promise<void>;
    delete(id: TaskId, tenantId: TenantId): Promise<void>;
    findAllByBoardId(boardId: string, tenantId: TenantId): Promise<Task[]>;
    findAllByTenant(tenantId: TenantId): Promise<Task[]>;
    findFavoriteTaskIdsForUser(tenantId: TenantId, userId: string): Promise<string[]>;
    setFavoriteForUser(tenantId: TenantId, taskId: TaskId, userId: string, isFavorite: boolean): Promise<void>;
    private mapToDomain;
}
//# sourceMappingURL=task-repository-postgres.d.ts.map