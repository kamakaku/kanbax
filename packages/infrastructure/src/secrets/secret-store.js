"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptedSecretStore = void 0;
class EncryptedSecretStore {
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
exports.EncryptedSecretStore = EncryptedSecretStore;
//# sourceMappingURL=secret-store.js.map