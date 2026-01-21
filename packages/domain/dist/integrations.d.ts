import { TenantId } from './task';
export interface JiraIssueMinimal {
    issueKey: string;
    summary: string;
    status: string;
    url: string;
    updatedAt: Date;
}
export interface EmailMetadata {
    messageId: string;
    subject: string;
    sender: string;
    senderDomain: string;
    receivedAt: Date;
}
export interface CredentialProvider {
    getCredentials(tenantId: TenantId, integrationId: string): Promise<any>;
}
export interface JiraAdapter {
    getIssueMinimal(tenantId: TenantId, issueKey: string): Promise<JiraIssueMinimal>;
    searchIssuesMinimal(tenantId: TenantId, jql: string): Promise<JiraIssueMinimal[]>;
}
export interface EmailIngestAdapter {
    extractMetadata(payload: any): Promise<EmailMetadata>;
}
//# sourceMappingURL=integrations.d.ts.map