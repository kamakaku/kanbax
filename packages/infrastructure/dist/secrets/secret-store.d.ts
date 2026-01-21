import { SecretStore, TenantId } from '@kanbax/domain';
export declare class EncryptedSecretStore implements SecretStore {
    private secrets;
    getSecret(tenantId: TenantId, key: string): Promise<string | null>;
    setSecret(tenantId: TenantId, key: string, value: string, metadata?: Record<string, any>): Promise<void>;
    deleteSecret(tenantId: TenantId, key: string): Promise<void>;
}
//# sourceMappingURL=secret-store.d.ts.map