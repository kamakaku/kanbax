import { AuditAction, PolicyContext, Task, JiraAdapter } from '@kanbax/domain';
import { Command, CommandPipeline } from './command-pipeline.js';
export interface LinkJiraTaskCommand extends Command<{
    deployment: 'cloud' | 'data_center';
    issueKey: string;
    boardId: string;
}> {
    type: 'JIRA_LINK_TASK';
}
export declare class LinkJiraTaskPipeline extends CommandPipeline<LinkJiraTaskCommand, Task> {
    private jiraCloudAdapter;
    private jiraDCAdapter;
    constructor(policyEngine: any, auditLogger: any, repository: any, jiraCloudAdapter: JiraAdapter, jiraDCAdapter: JiraAdapter);
    protected validate(command: LinkJiraTaskCommand): void;
    protected loadPolicyContext(command: LinkJiraTaskCommand): Promise<PolicyContext>;
    protected handle(command: LinkJiraTaskCommand, context: PolicyContext): Promise<Task>;
    protected getResourceId(command: LinkJiraTaskCommand): string;
    protected getResourceType(): 'TASK';
    protected getAuditAction(): AuditAction;
    protected getRequiredPermissions(): string[];
}
//# sourceMappingURL=link-jira-task-pipeline.d.ts.map