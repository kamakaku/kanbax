import { JiraAdapter, JiraIssueMinimal, TenantId, CredentialProvider } from '@kanbax/domain';

export class JiraCloudAdapter implements JiraAdapter {
    constructor(private credentialProvider: CredentialProvider) { }

    async getIssueMinimal(tenantId: TenantId, issueKey: string): Promise<JiraIssueMinimal> {
        // Stub implementation
        console.log(`[JiraCloud] Fetching minimal issue ${issueKey} for tenant ${tenantId}`);
        return {
            issueKey,
            summary: `Jira Cloud Issue ${issueKey}`,
            status: 'To Do',
            url: `https://kanbax-test.atlassian.net/browse/${issueKey}`,
            updatedAt: new Date(),
        };
    }

    async searchIssuesMinimal(tenantId: TenantId, jql: string): Promise<JiraIssueMinimal[]> {
        console.log(`[JiraCloud] Searching issues with JQL: ${jql} for tenant ${tenantId}`);
        return [];
    }
}

export class JiraDataCenterAdapter implements JiraAdapter {
    constructor(private credentialProvider: CredentialProvider) { }

    async getIssueMinimal(tenantId: TenantId, issueKey: string): Promise<JiraIssueMinimal> {
        // Stub implementation
        console.log(`[JiraDC] Fetching minimal issue ${issueKey} for tenant ${tenantId}`);
        return {
            issueKey,
            summary: `Jira DC Issue ${issueKey}`,
            status: 'Open',
            url: `https://jira.internal/browse/${issueKey}`,
            updatedAt: new Date(),
        };
    }

    async searchIssuesMinimal(tenantId: TenantId, jql: string): Promise<JiraIssueMinimal[]> {
        console.log(`[JiraDC] Searching issues with JQL: ${jql} for tenant ${tenantId}`);
        return [];
    }
}
