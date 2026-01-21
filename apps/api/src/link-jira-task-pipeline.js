"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkJiraTaskPipeline = void 0;
const domain_1 = require("@kanbax/domain");
const command_pipeline_1 = require("./command-pipeline");
class LinkJiraTaskPipeline extends command_pipeline_1.CommandPipeline {
    jiraCloudAdapter;
    jiraDCAdapter;
    constructor(policyEngine, auditLogger, repository, jiraCloudAdapter, jiraDCAdapter) {
        super(policyEngine, auditLogger, repository);
        this.jiraCloudAdapter = jiraCloudAdapter;
        this.jiraDCAdapter = jiraDCAdapter;
    }
    validate(command) {
        if (!command.payload.issueKey)
            throw new Error('Issue Key is required');
        if (!command.payload.boardId)
            throw new Error('Board ID is required');
    }
    async loadPolicyContext(command) {
        return {
            tenantId: command.tenantId,
            scope: 'BOARD',
            scopeId: command.payload.boardId,
            rules: [
                { id: 'jira-link-1', action: 'JIRA_LINK_TASK', effect: 'ALLOW' },
                { id: 'jira-fetch-1', action: 'JIRA_FETCH_MINIMAL', effect: 'ALLOW' }
            ],
            auditLevel: 'FULL',
        };
    }
    async handle(command, context) {
        const adapter = command.payload.deployment === 'cloud' ? this.jiraCloudAdapter : this.jiraDCAdapter;
        // Policy check for fetching minimal data (structural enforcement)
        const issue = await adapter.getIssueMinimal(command.tenantId, command.payload.issueKey);
        const task = {
            id: Math.random().toString(36).substring(2, 15),
            tenantId: command.tenantId,
            title: `[${issue.issueKey}] ${issue.summary}`,
            status: domain_1.TaskStatus.TODO,
            priority: domain_1.TaskPriority.MEDIUM,
            assignees: [],
            labels: [],
            source: {
                type: 'JIRA',
                issueKey: issue.issueKey,
                instanceUrl: issue.url.split('/browse/')[0],
                instanceType: command.payload.deployment === 'cloud' ? 'CLOUD' : 'DATA_CENTER',
                syncMode: 'link',
            },
            policyContext: context,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
        };
        await this.repository.save(task);
        return task;
    }
    getResourceId(command) {
        return command.payload.issueKey;
    }
    getResourceType() {
        return 'TASK';
    }
    getAuditAction() {
        return domain_1.AuditAction.TASK_CREATE;
    }
}
exports.LinkJiraTaskPipeline = LinkJiraTaskPipeline;
//# sourceMappingURL=link-jira-task-pipeline.js.map