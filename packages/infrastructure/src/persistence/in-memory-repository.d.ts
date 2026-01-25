import { Task, TaskId, TaskRepository, TenantId } from '@kanbax/domain';
export declare class InMemoryTaskRepository implements TaskRepository {
    private tasks;
    findById(id: TaskId, tenantId: TenantId): Promise<Task | null>;
    save(task: Task): Promise<void>;
    delete(id: TaskId, tenantId: TenantId): Promise<void>;
    findAllByBoardId(boardId: string, tenantId: TenantId): Promise<Task[]>;
    findAllByTenant(tenantId: TenantId): Promise<Task[]>;
}
//# sourceMappingURL=in-memory-repository.d.ts.map
