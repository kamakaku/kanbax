export type TaskId = string;
export type UserId = string;
export type TenantId = string;
export declare enum TaskStatus {
    TODO = "TODO",
    IN_PROGRESS = "IN_PROGRESS",
    DONE = "DONE",
    BLOCKED = "BLOCKED"
}
export declare enum TaskPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export type ManualSource = {
    type: 'MANUAL';
    createdBy: UserId;
};
export type JiraSource = {
    type: 'JIRA';
    issueKey: string;
    instanceUrl: string;
    instanceType: 'CLOUD' | 'DATA_CENTER';
    syncMode: 'link' | 'full';
};
export type EmailSource = {
    type: 'EMAIL';
    messageId: string;
    sender: string;
    receivedAt: Date;
    contentMode: 'metadata' | 'full';
};
export type TaskSource = ManualSource | JiraSource | EmailSource;
export interface PolicyContext {
    tenantId: TenantId;
    scope: 'TENANT' | 'PROJECT' | 'BOARD';
    scopeId: string;
    rules: PolicyRule[];
    retentionDays?: number;
    auditLevel: 'BASIC' | 'FULL';
}
export interface PolicyRule {
    id: string;
    action: string;
    effect: 'ALLOW' | 'DENY';
    condition?: string;
}
export interface Task {
    id: TaskId;
    tenantId: TenantId;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date;
    assignees: UserId[];
    labels: string[];
    source: TaskSource;
    policyContext: PolicyContext;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface TaskRepository {
    findById(id: TaskId, tenantId: TenantId): Promise<Task | null>;
    save(task: Task): Promise<void>;
    delete(id: TaskId, tenantId: TenantId): Promise<void>;
    findAllByBoardId(boardId: string, tenantId: TenantId): Promise<Task[]>;
}
//# sourceMappingURL=task.d.ts.map