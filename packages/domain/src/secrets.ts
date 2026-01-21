import { TenantId } from './task';

export interface Secret {
    id: string;
    tenantId: TenantId;
    key: string;
    value: string; // Encrypted
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface SecretStore {
    getSecret(tenantId: TenantId, key: string): Promise<string | null>;
    setSecret(tenantId: TenantId, key: string, value: string, metadata?: Record<string, any>): Promise<void>;
    deleteSecret(tenantId: TenantId, key: string): Promise<void>;
}
