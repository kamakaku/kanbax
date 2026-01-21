"use strict";
// Standalone Tenant Isolation Verification Test
// This file verifies that commands cannot access data of other tenants and audit events include tenant context.
Object.defineProperty(exports, "__esModule", { value: true });
// --- DOMAIN MODELS (Simplified for test) ---
var ActorType;
(function (ActorType) {
    ActorType["USER"] = "USER";
    ActorType["SYSTEM"] = "SYSTEM";
})(ActorType || (ActorType = {}));
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
            if (rule.action === '*' || rule.action === action) {
                matchedRules.push(rule);
                if (rule.effect === 'DENY')
                    explicitDeny = true;
                else if (rule.effect === 'ALLOW')
                    explicitAllow = true;
            }
        }
        if (explicitDeny)
            return { allowed: false, matchedRules, reason: 'Explicitly denied' };
        if (explicitAllow)
            return { allowed: true, matchedRules };
        return { allowed: false, matchedRules, reason: 'Default Deny' };
    }
}
// --- AUDIT LOGGER ---
class InMemoryAppendOnlyLogger {
    events = [];
    async log(event) {
        this.events.push({ ...event, id: Math.random().toString(36), timestamp: new Date() });
    }
    getEvents() { return this.events; }
}
// --- REPOSITORY ---
class InMemoryTaskRepository {
    tasks = new Map();
    async save(task) { this.tasks.set(task.id, task); }
    async findById(id, tenantId) {
        const task = this.tasks.get(id);
        return (task && task.tenantId === tenantId) ? task : null;
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
        // Cross-tenant check: context tenant must match command tenant
        if (context.tenantId !== command.tenantId) {
            throw new Error('Tenant Isolation Violation: Context tenant mismatch');
        }
        const decision = await this.policyEngine.evaluate(command.actorId, command.type, context, command.payload);
        if (!decision.allowed) {
            await this.auditLogger.log({
                actorId: command.actorId,
                actorType: command.actorType,
                tenantId: command.tenantId,
                action: AuditAction.ACCESS_DENIED,
                resourceId: 'unknown',
                resourceType: 'TASK',
                payload: command.payload,
                policyDecision: { outcome: 'DENY', reason: decision.reason },
            });
            throw new Error(`Access Denied: ${decision.reason}`);
        }
        const result = await this.handle(command, context);
        await this.auditLogger.log({
            actorId: command.actorId,
            actorType: command.actorType,
            tenantId: command.tenantId,
            action: AuditAction.TASK_CREATE,
            resourceId: 'new-task',
            resourceType: 'TASK',
            payload: command.payload,
            policyDecision: { outcome: 'ALLOW' },
        });
        return result;
    }
}
class CreateTaskPipeline extends CommandPipeline {
    async loadPolicyContext(command) {
        // Simulate fetching context for the board
        // In a real scenario, we'd verify the board belongs to the tenant
        return {
            tenantId: command.tenantId, // Correctly scoped
            scope: 'BOARD',
            scopeId: command.payload.boardId,
            rules: [{ id: 'rule-1', action: 'TASK_CREATE', effect: 'ALLOW' }],
            auditLevel: 'FULL',
        };
    }
    async handle(command, context) {
        const task = { id: 'task-1', tenantId: command.tenantId, ...command.payload };
        await this.repository.save(task);
        return task;
    }
}
// --- TESTS ---
async function runTests() {
    console.log('Running Tenant Isolation Verification Tests...\n');
    const policyEngine = new HardenedPolicyEngine();
    const auditLogger = new InMemoryAppendOnlyLogger();
    const repository = new InMemoryTaskRepository();
    const pipeline = new CreateTaskPipeline(policyEngine, auditLogger, repository);
    // Test 1: Successful creation within tenant
    console.log('Test 1: Successful creation within tenant');
    await pipeline.execute({
        type: 'TASK_CREATE',
        actorId: 'user-1',
        actorType: ActorType.USER,
        tenantId: 'tenant-a',
        payload: { title: 'Task A', boardId: 'board-1' }
    });
    const task = await repository.findById('task-1', 'tenant-a');
    if (task)
        console.log('Result: SUCCESS (Task found in tenant-a)');
    else
        console.error('Result: FAILED');
    // Test 2: Cross-tenant access prevention
    console.log('\nTest 2: Cross-tenant access prevention');
    const crossTask = await repository.findById('task-1', 'tenant-b');
    if (!crossTask)
        console.log('Result: SUCCESS (Task not accessible from tenant-b)');
    else
        console.error('Result: FAILED (Task leaked to tenant-b)');
    // Test 3: Audit event includes tenant context
    console.log('\nTest 3: Audit event includes tenant context');
    const events = auditLogger.getEvents();
    const lastEvent = events[events.length - 1];
    if (lastEvent.tenantId === 'tenant-a' && lastEvent.actorType === ActorType.USER) {
        console.log('Result: SUCCESS (Audit event correctly scoped)');
    }
    else {
        console.error('Result: FAILED (Audit event missing context)');
    }
}
runTests().catch(console.error);
//# sourceMappingURL=tenant-isolation.test.js.map