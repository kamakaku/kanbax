import { AuditAction, AuditEvent, AuditLogger, UserId } from '@kanbax/domain';

export interface AppendOnlyAuditLogger extends AuditLogger {
    getEvents(): ReadonlyArray<AuditEvent>;
}

export class InMemoryAppendOnlyLogger implements AppendOnlyAuditLogger {
    private events: AuditEvent[] = [];

    async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
        const fullEvent: AuditEvent = Object.freeze({
            ...event,
            id: this.generateId(),
            timestamp: new Date(),
            payload: Object.freeze({ ...event.payload }),
        });

        this.events.push(fullEvent);
        console.log('[AUDIT LOG]', JSON.stringify(fullEvent, null, 2));
    }

    getEvents(): ReadonlyArray<AuditEvent> {
        return Object.freeze([...this.events]);
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}
