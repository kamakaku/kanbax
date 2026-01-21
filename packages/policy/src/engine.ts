import { PolicyContext, PolicyRule, Task, UserId, TaskSource, PolicyDecision, PolicyEngine } from '@kanbax/domain';

export class HardenedPolicyEngine implements PolicyEngine {
    async evaluate(
        actorId: UserId,
        action: string,
        context: PolicyContext,
        resource?: any
    ): Promise<PolicyDecision> {
        const matchedRules: PolicyRule[] = [];
        let explicitDeny = false;
        let explicitAllow = false;

        for (const rule of context.rules) {
            if (this.matchesRule(rule, action, actorId, resource)) {
                matchedRules.push(rule);
                if (rule.effect === 'DENY') {
                    explicitDeny = true;
                } else if (rule.effect === 'ALLOW') {
                    explicitAllow = true;
                }
            }
        }

        // deny-overrides-allow
        if (explicitDeny) {
            return {
                allowed: false,
                matchedRules,
                reason: 'Explicitly denied by policy (Deny-Overrides-Allow)',
            };
        }

        if (explicitAllow) {
            return {
                allowed: true,
                matchedRules,
            };
        }

        // default deny
        return {
            allowed: false,
            matchedRules,
            reason: 'No matching allow rule found (Default Deny)',
        };
    }

    private matchesRule(rule: PolicyRule, action: string, actorId: UserId, resource?: any): boolean {
        // Action match
        if (rule.action !== '*' && rule.action !== action) {
            return false;
        }

        // Condition match
        if (rule.condition) {
            return this.evaluateCondition(rule.condition, { actorId, resource });
        }

        return true;
    }

    private evaluateCondition(condition: string, context: any): boolean {
        // Simple condition evaluator for the skeleton
        // Supports: source.type=JIRA, source.deployment=CLOUD, etc.
        const [key, value] = condition.split('=');
        if (!key || !value) return true;

        const parts = key.split('.');
        let current = context;
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else if (current && part === 'resource' && context.resource) {
                current = context.resource;
            } else {
                return false;
            }
        }

        return String(current) === value;
    }
}
