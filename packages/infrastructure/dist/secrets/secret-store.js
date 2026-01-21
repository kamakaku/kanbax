export class EncryptedSecretStore {
    secrets = new Map();
    async getSecret(tenantId, key) {
        const secretKey = `${tenantId}:${key}`;
        const value = this.secrets.get(secretKey);
        console.log(`[SecretStore] Accessing secret ${key} for tenant ${tenantId}`);
        return value || null;
    }
    async setSecret(tenantId, key, value, metadata) {
        const secretKey = `${tenantId}:${key}`;
        this.secrets.set(secretKey, value);
        console.log(`[SecretStore] Storing secret ${key} for tenant ${tenantId}`);
    }
    async deleteSecret(tenantId, key) {
        const secretKey = `${tenantId}:${key}`;
        this.secrets.delete(secretKey);
        console.log(`[SecretStore] Deleting secret ${key} for tenant ${tenantId}`);
    }
}
//# sourceMappingURL=secret-store.js.map