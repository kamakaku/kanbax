declare class MockAuditLogger {
    events: any[];
    log(event: any): Promise<void>;
}
declare class MockSecretStore {
    secrets: Map<string, string>;
    getSecret(tenantId: string, key: string): Promise<string | null>;
    setSecret(tenantId: string, key: string, value: string): Promise<void>;
}
declare enum PrincipalType {
    USER = "USER",
    SERVICE = "SERVICE",
    INTEGRATION = "INTEGRATION"
}
declare class CommandPipeline {
    private auditLogger;
    constructor(auditLogger: any);
    execute(command: any, requiredPermissions: string[]): Promise<string>;
}
declare function runIdentityTests(): Promise<void>;
//# sourceMappingURL=identity-access.test.d.ts.map