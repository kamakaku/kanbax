"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryService = void 0;
const domain_1 = require("@kanbax/domain");
class QueryService {
    taskRepository;
    auditRepository;
    constructor(taskRepository, auditRepository) {
        this.taskRepository = taskRepository;
        this.auditRepository = auditRepository;
    }
    async getTasks(principal) {
        // In a real app, this would use a specialized query repository.
        // Here we use the existing repository and map to views.
        const tasks = await this.taskRepository.findAllByBoardId('all', principal.tenantId);
        return tasks.map(t => this.mapToTaskView(t));
    }
    async getTaskById(id, principal) {
        const task = await this.taskRepository.findById(id, principal.tenantId);
        return task ? this.mapToTaskView(task) : null;
    }
    async getBoards(principal) {
        const tasks = await this.taskRepository.findAllByBoardId('all', principal.tenantId);
        // Group tasks by status for a default board view
        const statuses = [domain_1.TaskStatus.TODO, domain_1.TaskStatus.IN_PROGRESS, domain_1.TaskStatus.DONE];
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
    async getAuditEvents(principal) {
        // Check for admin permission (simplified)
        const isAdmin = principal.roles.some(r => r.name === 'ADMIN');
        if (!isAdmin)
            throw new Error('Unauthorized: Admin access required');
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
    mapToTaskView(task) {
        let sourceIndicator = 'Manual';
        if (task.source.type === 'JIRA')
            sourceIndicator = task.source.issueKey;
        if (task.source.type === 'EMAIL')
            sourceIndicator = 'Email';
        return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assignees: task.assignees,
            labels: task.labels,
            sourceType: task.source.type,
            sourceIndicator,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
        };
    }
}
exports.QueryService = QueryService;
//# sourceMappingURL=query-service.js.map