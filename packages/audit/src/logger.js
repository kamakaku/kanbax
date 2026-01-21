"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryAppendOnlyLogger = void 0;
class InMemoryAppendOnlyLogger {
    events = [];
    async log(event) {
        const fullEvent = Object.freeze({
            ...event,
            id: this.generateId(),
            timestamp: new Date(),
            payload: Object.freeze({ ...event.payload }),
        });
        this.events.push(fullEvent);
        console.log('[AUDIT LOG]', JSON.stringify(fullEvent, null, 2));
    }
    getEvents() {
        return Object.freeze([...this.events]);
    }
    generateId() {
        return Math.random().toString(36).substring(2, 15);
    }
}
exports.InMemoryAppendOnlyLogger = InMemoryAppendOnlyLogger;
//# sourceMappingURL=logger.js.map