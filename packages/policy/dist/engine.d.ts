import { PolicyContext, UserId, PolicyDecision, PolicyEngine } from '@kanbax/domain';
export declare class HardenedPolicyEngine implements PolicyEngine {
    evaluate(actorId: UserId, action: string, context: PolicyContext, resource?: any): Promise<PolicyDecision>;
    private matchesRule;
    private evaluateCondition;
}
//# sourceMappingURL=engine.d.ts.map