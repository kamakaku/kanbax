import { AuditAction, TaskPriority, TaskStatus } from '@kanbax/domain';
import { CommandPipeline } from './command-pipeline.js';
export class LinkJiraTaskPipeline extends CommandPipeline {
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
            status: TaskStatus.TODO,
            priority: TaskPriority.MEDIUM,
            dueDate: undefined,
            assignees: [],
            labels: [],
            kinds: [],
            attachments: [],
            comments: [],
            checklist: [],
            linkedTaskIds: [],
            activityLog: [],
            isFavorite: false,
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
        return AuditAction.TASK_CREATE;
    }
    getRequiredPermissions() {
        return ['task.create', 'jira.link'];
    }
}
//# sourceMappingURL=link-jira-task-pipeline.js.map