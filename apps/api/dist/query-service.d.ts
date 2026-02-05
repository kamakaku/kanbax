import { TaskRepository, AuditEventRepository, Principal, TaskView, AuditEventView, BoardView } from '@kanbax/domain';
export declare class QueryService {
    private taskRepository;
    private auditRepository;
    constructor(taskRepository: TaskRepository, auditRepository: AuditEventRepository);
    getTasks(principal: Principal, boardId?: string): Promise<TaskView[]>;
    getTaskById(id: string, principal: Principal): Promise<TaskView | null>;
    getBoards(principal: Principal): Promise<BoardView[]>;
    getAuditEvents(principal: Principal): Promise<AuditEventView[]>;
    private mapToTaskView;
    private getFavoriteSet;
}
//# sourceMappingURL=query-service.d.ts.map