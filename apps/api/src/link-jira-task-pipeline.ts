import {
    AuditAction,
    PolicyContext,
    Task,
    TaskId,
    TaskPriority,
    TaskStatus,
    TaskSource,
    TenantId,
    JiraAdapter,
    JiraIssueMinimal
} from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';

export interface LinkJiraTaskCommand extends Command<{
    deployment: 'cloud' | 'data_center';
    issueKey: string;
    boardId: string;
}> {
    type: 'JIRA_LINK_TASK';
}

export class LinkJiraTaskPipeline extends CommandPipeline<LinkJiraTaskCommand, Task> {
    constructor(
        policyEngine: any,
        auditLogger: any,
        repository: any,
        private jiraCloudAdapter: JiraAdapter,
        private jiraDCAdapter: JiraAdapter
    ) {
        super(policyEngine, auditLogger, repository);
    }

    protected validate(command: LinkJiraTaskCommand): void {
        if (!command.payload.issueKey) throw new Error('Issue Key is required');
        if (!command.payload.boardId) throw new Error('Board ID is required');
    }

    protected async loadPolicyContext(command: LinkJiraTaskCommand): Promise<PolicyContext> {
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

    protected async handle(command: LinkJiraTaskCommand, context: PolicyContext): Promise<Task> {
        const adapter = command.payload.deployment === 'cloud' ? this.jiraCloudAdapter : this.jiraDCAdapter;

        // Policy check for fetching minimal data (structural enforcement)
        const issue = await adapter.getIssueMinimal(command.tenantId, command.payload.issueKey);

        const task: Task = {
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

    protected getResourceId(command: LinkJiraTaskCommand): string {
        return command.payload.issueKey;
    }

    protected getResourceType(): 'TASK' {
        return 'TASK';
    }

    protected getAuditAction(): AuditAction {
        return AuditAction.TASK_CREATE;
    }

    protected getRequiredPermissions(): string[] {
        return ['task.create', 'jira.link'];
    }
}
