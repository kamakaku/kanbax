export type TaskId = string;
export type UserId = string;
export type TenantId = string;

export enum TaskStatus {
    BACKLOG = 'BACKLOG',
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',
    BLOCKED = 'BLOCKED',
    ARCHIVED = 'ARCHIVED',
}

export enum TaskPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export type TaskAttachment = {
    id: string;
    name: string;
    size: number;
    type: string;
    dataUrl: string;
    uploadedAt: Date;
};

export type TaskComment = {
    id: string;
    text: string;
    createdAt: Date;
    createdBy: UserId;
};

export type TaskChecklistItem = {
    id: string;
    text: string;
    done: boolean;
};

export type TaskActivity = {
    id: string;
    type: 'CREATE' | 'STATUS' | 'DETAILS' | 'COMMENT' | 'CHECKLIST' | 'ATTACHMENT' | 'LINK';
    message: string;
    timestamp: Date;
    actorId: UserId;
};

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
    condition?: string; // Declarative condition
}

export interface Task {
    id: TaskId;
    tenantId: TenantId;
    ownerId?: UserId | null;
    title: string;
    description?: string;
    kinds: string[];
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date;
    assignees: UserId[];
    labels: string[];
    attachments: TaskAttachment[];
    comments: TaskComment[];
    checklist: TaskChecklistItem[];
    linkedTaskIds: TaskId[];
    activityLog: TaskActivity[];
    isFavorite: boolean;
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
