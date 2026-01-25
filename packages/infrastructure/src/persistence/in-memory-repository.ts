import { Task, TaskId, TaskRepository, TenantId } from '@kanbax/domain';

export class InMemoryTaskRepository implements TaskRepository {
    private tasks: Map<TaskId, Task> = new Map();

    async findById(id: TaskId, tenantId: TenantId): Promise<Task | null> {
        const task = this.tasks.get(id);
        if (task && task.tenantId === tenantId) {
            return task;
        }
        return null;
    }

    async save(task: Task): Promise<void> {
        // Structural invariants check (basic)
        if (!task.id || !task.source || !task.policyContext) {
            throw new Error('Domain Invariant Violation: Task must have id, source, and policyContext');
        }
        this.tasks.set(task.id, { ...task });
    }

    async delete(id: TaskId, tenantId: TenantId): Promise<void> {
        const task = this.tasks.get(id);
        if (task && task.tenantId === tenantId) {
            this.tasks.delete(id);
        }
    }

    async findAllByBoardId(boardId: string, tenantId: TenantId): Promise<Task[]> {
        return Array.from(this.tasks.values()).filter(
            (task) => task.policyContext.scopeId === boardId && task.tenantId === tenantId
        );
    }

    async findAllByTenant(tenantId: TenantId): Promise<Task[]> {
        return Array.from(this.tasks.values()).filter((task) => task.tenantId === tenantId);
    }
}
