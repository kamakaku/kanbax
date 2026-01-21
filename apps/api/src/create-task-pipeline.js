"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTaskPipeline = void 0;
const domain_1 = require("@kanbax/domain");
const command_pipeline_1 = require("./command-pipeline");
class CreateTaskPipeline extends command_pipeline_1.CommandPipeline {
    validate(command) {
        if (!command.payload.title)
            throw new Error('Title is required');
        if (!command.payload.boardId)
            throw new Error('Board ID is required');
        if (!command.payload.source)
            throw new Error('Source is required');
    }
    async loadPolicyContext(command) {
        // In a real app, this would be fetched from a database
        return {
            tenantId: command.tenantId,
            scope: 'BOARD',
            scopeId: command.payload.boardId,
            rules: [
                { id: 'rule-1', action: 'TASK_CREATE', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' }
            ],
            auditLevel: 'FULL',
        };
    }
    async handle(command, context) {
        const task = {
            id: Math.random().toString(36).substring(2, 15),
            tenantId: command.tenantId,
            title: command.payload.title,
            description: command.payload.description,
            status: domain_1.TaskStatus.TODO,
            priority: domain_1.TaskPriority.MEDIUM,
            assignees: [],
            labels: [],
            source: command.payload.source,
            policyContext: context,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
        };
        await this.repository.save(task);
        return task;
    }
    getResourceId(command) {
        return 'new-task';
    }
    getResourceType() {
        return 'TASK';
    }
    getAuditAction() {
        return domain_1.AuditAction.TASK_CREATE;
    }
}
exports.CreateTaskPipeline = CreateTaskPipeline;
//# sourceMappingURL=create-task-pipeline.js.map