import {
    TaskRepository,
    AuditEventRepository,
    Principal,
    TaskView,
    AuditEventView,
    BoardView,
    TaskStatus
} from '@kanbax/domain';

export class QueryService {
    constructor(
        private taskRepository: TaskRepository,
        private auditRepository: AuditEventRepository
    ) { }

    async getTasks(principal: Principal, boardId = 'default-board'): Promise<TaskView[]> {
        // In a real app, this would use a specialized query repository.
        // Here we use the existing repository and map to views.
        if (boardId === 'all') {
            const tasks = await this.taskRepository.findAllByTenant(principal.tenantId);
            const favoriteSet = await this.getFavoriteSet(principal);
            return tasks
                .filter((task) => !task.excludeFromAll)
                .map(t => this.mapToTaskView(t, favoriteSet));
        }
        const tasks = await this.taskRepository.findAllByBoardId(boardId, principal.tenantId);
        const favoriteSet = await this.getFavoriteSet(principal);
        return tasks.map(t => this.mapToTaskView(t, favoriteSet));
    }

    async getTaskById(id: string, principal: Principal): Promise<TaskView | null> {
        const task = await this.taskRepository.findById(id, principal.tenantId);
        if (!task) return null;
        const favoriteSet = await this.getFavoriteSet(principal);
        return this.mapToTaskView(task, favoriteSet);
    }

    async getBoards(principal: Principal): Promise<BoardView[]> {
        const tasks = await this.taskRepository.findAllByBoardId('default-board', principal.tenantId);

        const statuses = [TaskStatus.BACKLOG, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
        const columns = statuses.map(status => ({
            status,
            tasks: tasks.filter(t => t.status === status).map(t => this.mapToTaskView(t))
        }));

        return [{
            id: 'default-board',
            name: 'Main Board',
            columns
        }];
    }

    async getAuditEvents(principal: Principal): Promise<AuditEventView[]> {
        // Check for admin permission (simplified)
        const isAdmin = principal.roles.some(r => r.name === 'ADMIN');
        if (!isAdmin) throw new Error('Unauthorized: Admin access required');

        const events = await this.auditRepository.findAllByTenant(principal.tenantId);
        return events.map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            actorId: e.actorId,
            actorType: e.actorType,
            action: e.action,
            resourceId: e.resourceId,
            resourceType: e.resourceType,
            outcome: e.policyDecision?.outcome || 'ALLOW'
        }));
    }

    private mapToTaskView(task: any, favoriteSet?: Set<string> | null): TaskView {
        let sourceIndicator = 'Manual';
        if (task.source.type === 'JIRA') sourceIndicator = task.source.issueKey;
        if (task.source.type === 'EMAIL') sourceIndicator = 'Email';

        return {
            id: task.id,
            tenantId: task.tenantId,
            boardId: task.policyContext?.scopeId ?? 'default-board',
            ownerId: task.ownerId ?? null,
            title: task.title,
            description: task.description,
            kinds: task.kinds,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            excludeFromAll: task.excludeFromAll ?? false,
            assignees: task.assignees,
            labels: task.labels,
            attachments: task.attachments ?? [],
            comments: task.comments ?? [],
            checklist: task.checklist ?? [],
            linkedTaskIds: task.linkedTaskIds ?? [],
            activityLog: task.activityLog ?? [],
            isFavorite: favoriteSet ? favoriteSet.has(task.id) : (task.isFavorite ?? false),
            sourceType: task.source.type,
            sourceIndicator,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
        };
    }

    private async getFavoriteSet(principal: Principal): Promise<Set<string> | null> {
        const repoAny = this.taskRepository as any;
        if (typeof repoAny.findFavoriteTaskIdsForUser !== 'function') {
            return null;
        }
        const favorites = await repoAny.findFavoriteTaskIdsForUser(principal.tenantId, principal.id);
        return new Set(favorites);
    }
}
