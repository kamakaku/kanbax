import { AuditAction, PrincipalType } from '@kanbax/domain';
import { CreateTaskPipeline } from '../create-task-pipeline';
import { HardenedPolicyEngine } from '@kanbax/policy';
import { InMemoryAppendOnlyLogger } from '@kanbax/audit';
import { InMemoryTaskRepository } from '@kanbax/infrastructure';
async function runHardeningTests() {
    console.log('Running Hardening Verification Tests...\n');
    const policyEngine = new HardenedPolicyEngine();
    const auditLogger = new InMemoryAppendOnlyLogger();
    const repository = new InMemoryTaskRepository();
    const pipeline = new CreateTaskPipeline(policyEngine, auditLogger, repository);
    // Test 1: Manual task creation is allowed (based on rule in CreateTaskPipeline)
    console.log('Test 1: Manual task creation is allowed');
    const manualCommand = {
        type: 'TASK_CREATE',
        tenantId: 'tenant-1',
        principal: { id: 'user-1', tenantId: 'tenant-1', type: PrincipalType.USER, roles: [], metadata: {} },
        payload: {
            title: 'Manual Task',
            boardId: 'board-1',
            source: { type: 'MANUAL', createdBy: 'user-1' }
        }
    };
    const task = await pipeline.execute(manualCommand);
    console.log('Result: SUCCESS', task.id);
    // Test 2: Jira task creation is denied by default (no rule matches)
    console.log('\nTest 2: Jira task creation is denied by default');
    const jiraCommand = {
        type: 'TASK_CREATE',
        tenantId: 'tenant-1',
        principal: { id: 'user-1', tenantId: 'tenant-1', type: PrincipalType.USER, roles: [], metadata: {} },
        payload: {
            title: 'Jira Task',
            boardId: 'board-1',
            source: {
                type: 'JIRA',
                issueKey: 'KAN-123',
                instanceUrl: 'https://jira.com',
                instanceType: 'CLOUD',
                syncMode: 'link'
            }
        }
    };
    try {
        await pipeline.execute(jiraCommand);
        console.error('Result: FAILED (Should have been denied)');
    }
    catch (e) {
        console.log('Result: SUCCESS (Denied as expected)', e.message);
    }
    // Test 3: Denied action still produces an AuditEvent
    console.log('\nTest 3: Denied action still produces an AuditEvent');
    const events = auditLogger.getEvents();
    const deniedEvent = events.find((e) => e.action === AuditAction.ACCESS_DENIED);
    if (deniedEvent) {
        console.log('Result: SUCCESS (Audit event found)', deniedEvent.id);
    }
    else {
        console.error('Result: FAILED (No audit event found)');
    }
    // Test 4: Task cannot be persisted without source + policyContext (Invariant check)
    console.log('\nTest 4: Task cannot be persisted without source (Invariant check)');
    try {
        await repository.save({ id: 'invalid' });
        console.error('Result: FAILED (Should have thrown invariant error)');
    }
    catch (e) {
        console.log('Result: SUCCESS (Invariant error caught)', e.message);
    }
    console.log('\nAll tests completed.');
}
runHardeningTests().catch(console.error);
//# sourceMappingURL=hardening.test.js.map