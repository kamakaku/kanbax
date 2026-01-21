import { SecretStore, TenantId } from '@kanbax/domain';

export class EncryptedSecretStore implements SecretStore {
    private secrets: Map<string, string> = new Map();

    async getSecret(tenantId: TenantId, key: string): Promise<string | null> {
        const secretKey = `${tenantId}:${key}`;
        const value = this.secrets.get(secretKey);

        console.log(`[SecretStore] Accessing secret ${key} for tenant ${tenantId}`);

        return value || null;
    }

    async setSecret(tenantId: TenantId, key: string, value: string, metadata?: Record<string, any>): Promise<void> {
        const secretKey = `${tenantId}:${key}`;
        this.secrets.set(secretKey, value);

        console.log(`[SecretStore] Storing secret ${key} for tenant ${tenantId}`);
    }

    async deleteSecret(tenantId: TenantId, key: string): Promise<void> {
        const secretKey = `${tenantId}:${key}`;
        this.secrets.delete(secretKey);

        console.log(`[SecretStore] Deleting secret ${key} for tenant ${tenantId}`);
    }
}
