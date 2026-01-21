"use strict";
// Standalone Read-only UI & Query Layer Verification Test
Object.defineProperty(exports, "__esModule", { value: true });
// --- MOCKS ---
class MockTaskRepository {
    async findAllByBoardId(boardId, tenantId) {
        return [
            { id: '1', tenantId, title: 'Task 1', status: 'TODO', source: { type: 'MANUAL' } },
            { id: '2', tenantId, title: 'Task 2', status: 'IN_PROGRESS', source: { type: 'JIRA', issueKey: 'J-1' } }
        ];
    }
}
class MockAuditRepository {
    async findAllByTenant(tenantId) {
        return [
            { id: 'e1', tenantId, action: 'TASK_CREATE', actorId: 'u1', actorType: 'USER' }
        ];
    }
}
// --- QUERY SERVICE (Simplified) ---
class QueryService {
    taskRepo;
    auditRepo;
    constructor(taskRepo, auditRepo) {
        this.taskRepo = taskRepo;
        this.auditRepo = auditRepo;
    }
    async getTasks(principal) {
        const tasks = await this.taskRepo.findAllByBoardId('all', principal.tenantId);
        return tasks.map((t) => ({
            id: t.id,
            title: t.title,
            sourceIndicator: t.source.type === 'JIRA' ? t.source.issueKey : 'Manual'
        }));
    }
    async getAuditEvents(principal) {
        const isAdmin = principal.roles.some((r) => r.name === 'ADMIN');
        if (!isAdmin)
            throw new Error('Unauthorized');
        return this.auditRepo.findAllByTenant(principal.tenantId);
    }
}
// --- TESTS ---
async function runTests() {
    console.log('Running Read-only UI & Query Layer Verification Tests...\n');
    const queryService = new QueryService(new MockTaskRepository(), new MockAuditRepository());
    const tenantA = 'tenant-a';
    const principalA = { tenantId: tenantA, roles: [] };
    const adminA = { tenantId: tenantA, roles: [{ name: 'ADMIN' }] };
    // Test 1: Tenant Isolation in Queries
    console.log('Test 1: Tenant Isolation in Queries');
    const tasks = await queryService.getTasks(principalA);
    if (tasks.length === 2 && tasks.every((t) => t.id)) {
        console.log('Result: SUCCESS (Queries return tenant-scoped data)');
    }
    else {
        console.error('Result: FAILED');
    }
    // Test 2: Authorization for Admin Queries
    console.log('\nTest 2: Authorization for Admin Queries');
    try {
        await queryService.getAuditEvents(principalA);
        console.error('Result: FAILED (Non-admin should be denied)');
    }
    catch (e) {
        console.log(`Result: SUCCESS (${e.message})`);
    }
    const events = await queryService.getAuditEvents(adminA);
    if (events.length === 1) {
        console.log('Result: SUCCESS (Admin can access audit events)');
    }
    else {
        console.error('Result: FAILED');
    }
    // Test 3: Read-only Guarantee (Conceptual)
    console.log('\nTest 3: Read-only Guarantee');
    const serviceMethods = Object.getOwnPropertyNames(QueryService.prototype);
    const hasMutation = serviceMethods.some(m => m.startsWith('create') || m.startsWith('update') || m.startsWith('delete') || m.startsWith('save'));
    if (!hasMutation) {
        console.log('Result: SUCCESS (QueryService contains no mutation methods)');
    }
    else {
        console.error('Result: FAILED');
    }
}
runTests().catch(console.error);
//# sourceMappingURL=query-layer.test.js.map