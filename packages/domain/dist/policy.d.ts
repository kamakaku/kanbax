import { UserId, PolicyContext } from './task';
import { PolicyRule } from './task';
export interface PolicyDecision {
    allowed: boolean;
    matchedRules: PolicyRule[];
    reason?: string;
}
export interface PolicyEngine {
    evaluate(actorId: UserId, action: string, context: PolicyContext, resource?: any): Promise<PolicyDecision>;
}
export interface PolicyContextRepository {
    findById(id: string, tenantId: string): Promise<PolicyContext | null>;
    save(context: PolicyContext): Promise<void>;
    delete(id: string, tenantId: string): Promise<void>;
}
//# sourceMappingURL=policy.d.ts.map