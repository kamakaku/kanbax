export class JiraCloudAdapter {
    credentialProvider;
    constructor(credentialProvider) {
        this.credentialProvider = credentialProvider;
    }
    async getIssueMinimal(tenantId, issueKey) {
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
    async searchIssuesMinimal(tenantId, jql) {
        console.log(`[JiraCloud] Searching issues with JQL: ${jql} for tenant ${tenantId}`);
        return [];
    }
}
export class JiraDataCenterAdapter {
    credentialProvider;
    constructor(credentialProvider) {
        this.credentialProvider = credentialProvider;
    }
    async getIssueMinimal(tenantId, issueKey) {
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
    async searchIssuesMinimal(tenantId, jql) {
        console.log(`[JiraDC] Searching issues with JQL: ${jql} for tenant ${tenantId}`);
        return [];
    }
}
//# sourceMappingURL=jira-adapter.js.map