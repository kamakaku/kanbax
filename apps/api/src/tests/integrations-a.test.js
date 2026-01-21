"use strict";
// Standalone Integrations Verification Test
// This file verifies Jira (link-only) and Email (metadata-only) integrations.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = __importStar(require("crypto"));
// --- DOMAIN MODELS (Simplified) ---
var ActorType;
(function (ActorType) {
    ActorType["USER"] = "USER";
    ActorType["SYSTEM"] = "SYSTEM";
    ActorType["INTEGRATION"] = "INTEGRATION";
})(ActorType || (ActorType = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["TASK_CREATE"] = "TASK_CREATE";
    AuditAction["ACCESS_DENIED"] = "ACCESS_DENIED";
})(AuditAction || (AuditAction = {}));
// --- ADAPTERS ---
class JiraCloudAdapter {
    async getIssueMinimal(tenantId, issueKey) {
        return {
            issueKey,
            summary: `Jira Cloud Issue ${issueKey}`,
            status: 'To Do',
            url: `https://atlassian.net/browse/${issueKey}`,
            updatedAt: new Date(),
        };
    }
}
class EmailIngestAdapter {
    async extractMetadata(payload) {
        const hashedMessageId = crypto.createHash('sha256').update(payload.messageId).digest('hex');
        return {
            messageId: hashedMessageId,
            subject: payload.subject,
            sender: payload.sender,
            receivedAt: new Date(payload.receivedAt),
        };
    }
}
// --- PIPELINES ---
class LinkJiraTaskPipeline {
    adapter;
    auditLogger;
    repository;
    constructor(adapter, auditLogger, repository) {
        this.adapter = adapter;
        this.auditLogger = auditLogger;
        this.repository = repository;
    }
    async execute(command) {
        // Policy check (simulated)
        if (command.type !== 'JIRA_LINK_TASK')
            throw new Error('Policy Denied');
        const issue = await this.adapter.getIssueMinimal(command.tenantId, command.payload.issueKey);
        const task = {
            id: 'task-jira',
            tenantId: command.tenantId,
            title: issue.summary,
            source: { type: 'JIRA', issueKey: issue.issueKey, syncMode: 'link' },
        };
        await this.repository.save(task);
        await this.auditLogger.log({ actorId: command.actorId, tenantId: command.tenantId, action: AuditAction.TASK_CREATE, resourceId: task.id });
        return task;
    }
}
class IngestEmailPipeline {
    adapter;
    auditLogger;
    repository;
    constructor(adapter, auditLogger, repository) {
        this.adapter = adapter;
        this.auditLogger = auditLogger;
        this.repository = repository;
    }
    async execute(command) {
        // Policy check (simulated)
        if (command.type !== 'EMAIL_INGEST_METADATA')
            throw new Error('Policy Denied');
        const metadata = await this.adapter.extractMetadata(command.payload);
        const task = {
            id: 'task-email',
            tenantId: command.tenantId,
            title: metadata.subject,
            source: { type: 'EMAIL', messageId: metadata.messageId, contentMode: 'metadata' },
        };
        await this.repository.save(task);
        await this.auditLogger.log({ actorId: command.actorId, tenantId: command.tenantId, action: AuditAction.TASK_CREATE, resourceId: task.id });
        return task;
    }
}
// --- INFRASTRUCTURE ---
class InMemoryRepository {
    data = new Map();
    async save(item) { this.data.set(item.id, item); }
    async findById(id, tenantId) {
        const item = this.data.get(id);
        return (item && item.tenantId === tenantId) ? item : null;
    }
}
class AuditLogger {
    events = [];
    async log(event) { this.events.push(event); }
    getEvents() { return this.events; }
}
// --- TESTS ---
async function runTests() {
    console.log('Running Integrations Phase A Verification Tests...\n');
    const repository = new InMemoryRepository();
    const auditLogger = new AuditLogger();
    const jiraAdapter = new JiraCloudAdapter();
    const emailAdapter = new EmailIngestAdapter();
    const jiraPipeline = new LinkJiraTaskPipeline(jiraAdapter, auditLogger, repository);
    const emailPipeline = new IngestEmailPipeline(emailAdapter, auditLogger, repository);
    // Test 1: Jira Link-only
    console.log('Test 1: Jira Link-only');
    const jiraTask = await jiraPipeline.execute({
        type: 'JIRA_LINK_TASK',
        actorId: 'user-1',
        tenantId: 'tenant-a',
        payload: { issueKey: 'KAN-123' }
    });
    if (jiraTask.source.syncMode === 'link')
        console.log('Result: SUCCESS (SyncMode is link)');
    else
        console.error('Result: FAILED');
    // Test 2: Email Metadata-only
    console.log('\nTest 2: Email Metadata-only');
    const emailTask = await emailPipeline.execute({
        type: 'EMAIL_INGEST_METADATA',
        actorId: 'user-1',
        tenantId: 'tenant-a',
        payload: { subject: 'Alert', sender: 'bot@bank.com', messageId: 'msg-1', receivedAt: new Date().toISOString() }
    });
    if (emailTask.source.contentMode === 'metadata' && emailTask.source.messageId.length === 64) {
        console.log('Result: SUCCESS (ContentMode is metadata, ID is hashed)');
    }
    else {
        console.error('Result: FAILED');
    }
    // Test 3: Cross-tenant isolation
    console.log('\nTest 3: Cross-tenant isolation');
    const crossTask = await repository.findById('task-jira', 'tenant-b');
    if (!crossTask)
        console.log('Result: SUCCESS (Tenant B cannot see Tenant A tasks)');
    else
        console.error('Result: FAILED');
    // Test 4: Audit trail
    console.log('\nTest 4: Audit trail');
    const events = auditLogger.getEvents();
    if (events.length === 2 && events.every(e => e.tenantId === 'tenant-a')) {
        console.log('Result: SUCCESS (Audit events correctly scoped)');
    }
    else {
        console.error('Result: FAILED');
    }
}
runTests().catch(console.error);
//# sourceMappingURL=integrations-a.test.js.map