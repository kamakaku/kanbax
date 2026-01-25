export class InMemoryTaskRepository {
    tasks = new Map();
    async findById(id, tenantId) {
        const task = this.tasks.get(id);
        if (task && task.tenantId === tenantId) {
            return task;
        }
        return null;
    }
    async save(task) {
        // Structural invariants check (basic)
        if (!task.id || !task.source || !task.policyContext) {
            throw new Error('Domain Invariant Violation: Task must have id, source, and policyContext');
        }
        this.tasks.set(task.id, { ...task });
    }
    async delete(id, tenantId) {
        const task = this.tasks.get(id);
        if (task && task.tenantId === tenantId) {
            this.tasks.delete(id);
        }
    }
    async findAllByBoardId(boardId, tenantId) {
        return Array.from(this.tasks.values()).filter((task) => task.policyContext.scopeId === boardId && task.tenantId === tenantId);
    }
    async findAllByTenant(tenantId) {
        return Array.from(this.tasks.values()).filter((task) => task.tenantId === tenantId);
    }
}
//# sourceMappingURL=in-memory-repository.js.map