import { JiraAdapter, JiraIssueMinimal, TenantId, CredentialProvider } from '@kanbax/domain';
export declare class JiraCloudAdapter implements JiraAdapter {
    private credentialProvider;
    constructor(credentialProvider: CredentialProvider);
    getIssueMinimal(tenantId: TenantId, issueKey: string): Promise<JiraIssueMinimal>;
    searchIssuesMinimal(tenantId: TenantId, jql: string): Promise<JiraIssueMinimal[]>;
}
export declare class JiraDataCenterAdapter implements JiraAdapter {
    private credentialProvider;
    constructor(credentialProvider: CredentialProvider);
    getIssueMinimal(tenantId: TenantId, issueKey: string): Promise<JiraIssueMinimal>;
    searchIssuesMinimal(tenantId: TenantId, jql: string): Promise<JiraIssueMinimal[]>;
}
//# sourceMappingURL=jira-adapter.d.ts.map