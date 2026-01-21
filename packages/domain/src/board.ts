import { TaskStatus } from './task';

export type BoardId = string;

export interface WorkflowStatus {
    id: string;
    name: string;
    type: TaskStatus;
    order: number;
}

export interface Workflow {
    id: string;
    statuses: WorkflowStatus[];
}

export interface Board {
    id: BoardId;
    name: string;
    description?: string;
    workflow: Workflow;
    tenantId: string;
    projectId: string;
}

export interface BoardRepository {
  findById(id: BoardId): Promise<Board | null>;
  save(board: Board): Promise<void>;
  delete(id: BoardId): Promise<void>;
}
