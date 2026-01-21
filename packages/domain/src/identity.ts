import { TenantId } from './task';

export type PrincipalId = string;

export enum PrincipalType {
    USER = 'USER',
    SERVICE = 'SERVICE',
    INTEGRATION = 'INTEGRATION',
}

export interface Permission {
    id: string;
    tenantId: TenantId;
    name: string; // e.g. "task.create"
    description?: string;
}

export interface Role {
    id: string;
    tenantId: TenantId;
    name: string;
    permissions: Permission[];
}

export interface Principal {
    id: PrincipalId;
    tenantId: TenantId;
    type: PrincipalType;
    roles: Role[];
    metadata: Record<string, any>;
}

export interface PrincipalRepository {
    findById(id: PrincipalId, tenantId: TenantId): Promise<Principal | null>;
    save(principal: Principal): Promise<void>;
}

export interface RoleRepository {
    findById(id: string, tenantId: TenantId): Promise<Role | null>;
    findAllByTenant(tenantId: TenantId): Promise<Role[]>;
    save(role: Role): Promise<void>;
}
