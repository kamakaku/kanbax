import { AuditEvent, AuditLogger } from '@kanbax/domain';
export interface AppendOnlyAuditLogger extends AuditLogger {
    getEvents(): ReadonlyArray<AuditEvent>;
}
export declare class InMemoryAppendOnlyLogger implements AppendOnlyAuditLogger {
    private events;
    log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;
    getEvents(): ReadonlyArray<AuditEvent>;
    private generateId;
}
//# sourceMappingURL=logger.d.ts.map