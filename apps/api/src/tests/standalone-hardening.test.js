"use strict";
// Standalone Hardening Verification Test
// This file includes all necessary logic to verify hardening without external dependencies.
Object.defineProperty(exports, "__esModule", { value: true });
// --- DOMAIN MODELS ---
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["TODO"] = "TODO";
})(TaskStatus || (TaskStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["MEDIUM"] = "MEDIUM";
})(TaskPriority || (TaskPriority = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["TASK_CREATE"] = "TASK_CREATE";
    AuditAction["ACCESS_DENIED"] = "ACCESS_DENIED";
})(AuditAction || (AuditAction = {}));
// --- POLICY ENGINE ---
class HardenedPolicyEngine {
    async evaluate(actorId, action, context, resource) {
        const matchedRules = [];
        let explicitDeny = false;
        let explicitAllow = false;
        for (const rule of context.rules) {
            if (this.matchesRule(rule, action, actorId, resource)) {
                matchedRules.push(rule);
                if (rule.effect === 'DENY')
                    explicitDeny = true;
                else if (rule.effect === 'ALLOW')
                    explicitAllow = true;
            }
        }
        if (explicitDeny)
            return { allowed: false, matchedRules, reason: 'Explicitly denied by policy' };
        if (explicitAllow)
            return { allowed: true, matchedRules };
        return { allowed: false, matchedRules, reason: 'No matching allow rule found (Default Deny)' };
    }
    matchesRule(rule, action, actorId, resource) {
        if (rule.action !== '*' && rule.action !== action)
            return false;
        if (rule.condition)
            return this.evaluateCondition(rule.condition, { actorId, resource });
        return true;
    }
    evaluateCondition(condition, context) {
        const [key, value] = condition.split('=');
        if (!key || !value)
            return true;
        const parts = key.split('.');
        let current = context;
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current)
                current = current[part];
            else
                return false;
        }
        return String(current) === value;
    }
}
// --- AUDIT LOGGER ---
class InMemoryAppendOnlyLogger {
    events = [];
    async log(event) {
        const fullEvent = Object.freeze({ ...event, id: Math.random().toString(36).substring(2, 15), timestamp: new Date() });
        this.events.push(fullEvent);
        console.log('[AUDIT LOG]', JSON.stringify(fullEvent, null, 2));
    }
    getEvents() { return Object.freeze([...this.events]); }
}
// --- REPOSITORY ---
class InMemoryTaskRepository {
    tasks = new Map();
    async save(task) {
        if (!task.id || !task.source || !task.policyContext)
            throw new Error('Domain Invariant Violation');
        this.tasks.set(task.id, { ...task });
    }
}
// --- PIPELINE ---
class CommandPipeline {
    policyEngine;
    auditLogger;
    repository;
    constructor(policyEngine, auditLogger, repository) {
        this.policyEngine = policyEngine;
        this.auditLogger = auditLogger;
        this.repository = repository;
    }
    async execute(command) {
        const context = await this.loadPolicyContext(command);
        const decision = await this.policyEngine.evaluate(command.actorId, command.type, context, command.payload);
        if (!decision.allowed) {
            await this.auditLogger.log({
                actorId: command.actorId,
                action: AuditAction.ACCESS_DENIED,
                resourceId: 'unknown',
                resourceType: 'TASK',
                payload: command.payload,
                policyDecision: { outcome: 'DENY', reason: decision.reason },
                metadata: { tenantId: context.scopeId },
            });
            throw new Error(`Access Denied: ${decision.reason}`);
        }
        const result = await this.handle(command, context);
        await this.auditLogger.log({
            actorId: command.actorId,
            action: AuditAction.TASK_CREATE,
            resourceId: 'new-task',
            resourceType: 'TASK',
            payload: command.payload,
            policyDecision: { outcome: 'ALLOW' },
            metadata: { tenantId: context.scopeId },
        });
        return result;
    }
}
class CreateTaskPipeline extends CommandPipeline {
    async loadPolicyContext(command) {
        return {
            scope: 'BOARD',
            scopeId: command.payload.boardId,
            rules: [{ id: 'rule-1', action: 'TASK_CREATE', effect: 'ALLOW', condition: 'resource.source.type=MANUAL' }],
            auditLevel: 'FULL',
        };
    }
    async handle(command, context) {
        const task = { id: 'task-1', ...command.payload, policyContext: context };
        await this.repository.save(task);
        return task;
    }
}
// --- TESTS ---
async function runTests() {
    console.log('Running Standalone Hardening Verification Tests...\n');
    const policyEngine = new HardenedPolicyEngine();
    const auditLogger = new InMemoryAppendOnlyLogger();
    const repository = new InMemoryTaskRepository();
    const pipeline = new CreateTaskPipeline(policyEngine, auditLogger, repository);
    // Test 1: Manual task creation is allowed
    console.log('Test 1: Manual task creation is allowed');
    await pipeline.execute({ type: 'TASK_CREATE', actorId: 'user-1', payload: { title: 'Manual', boardId: 'b1', source: { type: 'MANUAL' } } });
    console.log('Result: SUCCESS');
    // Test 2: Jira task creation is denied by default
    console.log('\nTest 2: Jira task creation is denied by default');
    try {
        await pipeline.execute({ type: 'TASK_CREATE', actorId: 'user-1', payload: { title: 'Jira', boardId: 'b1', source: { type: 'JIRA' } } });
    }
    catch (e) {
        console.log('Result: SUCCESS (Denied)', e.message);
    }
    // Test 3: Denied action produces AuditEvent
    console.log('\nTest 3: Denied action produces AuditEvent');
    const events = auditLogger.getEvents();
    if (events.some(e => e.action === AuditAction.ACCESS_DENIED))
        console.log('Result: SUCCESS');
    else
        console.error('Result: FAILED');
    // Test 4: Invariant check
    console.log('\nTest 4: Invariant check');
    try {
        await repository.save({ id: 'invalid' });
    }
    catch (e) {
        console.log('Result: SUCCESS (Invariant error)', e.message);
    }
}
runTests().catch(console.error);
//# sourceMappingURL=standalone-hardening.test.js.map